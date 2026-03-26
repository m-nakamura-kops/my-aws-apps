# セキュリティ設計書（QRコード打刻システム）

**WBS準拠**: 本ドキュメントはプロジェクトの絶対基準である [WBS](../../WBS.md) を主軸に、システム全体のセキュリティを可視化する。  
**保存先**: `apps/qr-attendance/docs/SECURITY_DESIGN.md`

---

## 1. 現状の報告：バックエンド共通基盤がシステム全体をどう守っているか

### 1.1 共通基盤の構成

バックエンドでは次の共通ユーティリティで**認証**と**役割（Role）に基づく権限**を一元管理している。

| モジュール | 役割 | 配置 |
|------------|------|------|
| **Auth** | トークンから利用者を特定し、DB の `role_flag` と照合して権限を判定する | `backend/shared/utils/auth.ts`（および各 Lambda の `shared/utils/auth.js`） |
| **RoleCheck** | `role_flag` の値（1=利用者, 2=スタッフ, 3=管理者）に応じた判定関数を提供 | `backend/shared/utils/role-check.ts` |

**Auth の主な関数**

- **getUserEmailFromRequest(event)**  
  - `Authorization: Bearer <token>` を優先して解析し、トークンから `email` を取得する。  
  - トークン形式は JWT（3 部分）またはローカル用の Base64 単体 JSON の両方に対応。  
  - 未設定・不正の場合は `null` を返し、呼び出し側で 401 を返す。
- **getUserRoleFlag(email)**  
  - DB の `users` テーブルから `role_flag` を取得する。**権限判定は常に DB の値に依存**し、トークン内の値だけでは許可しない。
- **checkAdminPermission(event)**  
  - メール取得 → `getUserRoleFlag` → `isAdmin(roleFlag)`。  
  - 未認証なら 401、認証済みだが管理者でないなら 403 用のエラーを返す。
- **checkStaffOrAdminPermission(event)**  
  - 同上の流れで `isStaffOrAdmin(roleFlag)` を判定。  
  - 未認証 → 401、認証済みだがスタッフ・管理者でない → 403。  
  - 成功時は `authorized: true` と `email`, `roleFlag` を返し、ハンドラ内で「誰が操作したか」の記録やスコープ制御に利用する。

**RoleCheck の主な関数**

- **isAdmin(roleFlag)**  
  - `roleFlag === 3` のときのみ true。管理者専用 API の可否に使用。
- **isStaffOrAdmin(roleFlag)**  
  - `roleFlag === 2 || roleFlag === 3` のとき true。手動打刻・生徒検索・参加者一覧・お知らせ CRUD などに使用。

これにより、「認証されていないリクエスト」「認証はされているが役割が足りないリクエスト」を API の入口で弾き、**手動打刻・名簿管理・イベント管理・レポート・スタッフ管理**などすべての機能を共通のルールで守っている。

### 1.2 機能領域ごとの守り方（具体的な対応）

#### 手動打刻（POST /v1/attendance/manual, GET /v1/students/search）

- **認証・権限**: 両方とも **checkStaffOrAdminPermission(event)** を最初に実行する。  
  - トークンなし・不正 → 401。  
  - 利用者（role_flag=1）でリクエスト → 403（「Staff or Admin access required」）。
- **業務ルール**: 手動打刻では「打刻対象は `role_flag = 1`（利用者）のユーザーに限定」するチェックをハンドラ内で実施している（`UserRole.USER` との比較）。  
  これにより、スタッフがスタッフや管理者を「生徒」として打刻することを防いでいる。
- **結果**: 手動打刻と生徒検索は「スタッフまたは管理者」だけが利用でき、かつ打刻対象は利用者（生徒）に限定される。

#### 生徒名簿管理（GET/POST/PUT/DELETE /v1/admin/students, POST import）

- **認証・権限**: すべて **checkAdminPermission(event)** を実行。  
  - 未認証 → 401。  
  - 利用者・スタッフでアクセス → 403（「Admin access required」）。
- **結果**: 生徒の一覧・新規登録・更新・削除・CSV 取込は**管理者のみ**が実行できる。不正アクセスや権限越えは 403 で拒否される。

#### イベント管理（GET/POST/PUT/DELETE /v1/admin/events, QR 取得・出席レポート）

- **認証・権限**: 一覧・作成・更新・削除・QR 取得・出席レポートはいずれも **checkAdminPermission(event)**。  
  - 管理者以外はすべて 403。
- **結果**: イベントの CRUD、管理用 QR、出席レポートは管理者専用となり、スタッフ・利用者からの変更や一覧取得はできない。

#### 参加者一覧（GET /v1/admin/events/{eventId}/participants）

- **認証・権限**: **checkStaffOrAdminPermission(event)** でスタッフ以上を許可。  
  - さらにハンドラ内で **isStaffOrAdmin(permission.roleFlag)** により、スタッフ・管理者は「全参加者の打刻状況」、利用者は「自身の参加・打刻状況のみ」にスコープを分けている。
- **結果**: 権限マトリクスどおり「出席確認はスタッフ・管理者は全員、利用者は自分だけ」が実現され、他者の打刻情報の取り違えや越権閲覧を防いでいる。

#### 打刻履歴（GET /v1/users/attendance/history）

- **認証**: **getUserEmailFromRequest(event)** のみ。  
  - トークンから取得した `email` で **自分の打刻履歴だけ** を WHERE 条件に使い、他者の履歴は返さない。
- **結果**: 利用者・スタッフ・管理者とも「自分の打刻履歴のみ」閲覧可能という権限マトリクスに沿っている。

#### QR 打刻（POST /v1/users/attendance）

- **認証・権限**: QR の署名検証に加え、**スタッフスキャン方式**のため **checkStaffOrAdminPermission(event)** で打刻実行者をスタッフ以上に限定。  
  - 利用者だけのトークンでは打刻リクエストを送っても 403。
- **結果**: 打刻はスタッフ・管理者のみが実行でき、なりすまし・不正打刻を抑止している。

#### スタッフ管理（GET/POST/PUT/DELETE /v1/admin/staffs, invite）

- **認証・権限**: すべて **checkAdminPermission(event)**。  
  - スタッフ一覧・招待・権限変更・「利用者に変更」は管理者のみ。
- **結果**: 役割の昇格・降格は管理者だけが行え、権限の不正な変更を防いでいる。

#### レポート CSV（GET /v1/admin/reports/events/{eventId}/csv）

- **認証・権限**: **checkAdminPermission(event)**。  
  - スタッフは 403。管理者のみ CSV 取得可能。
- **結果**: 出席データの一括ダウンロードは管理者に限定され、情報漏洩リスクを抑えている。

#### お知らせ管理（POST/PUT/DELETE /v1/admin/news）

- **認証・権限**: 作成・更新・削除は **checkStaffOrAdminPermission(event)**。  
  - 一覧（GET /v1/news）は認証済みなら誰でも閲覧可能（getUserEmailFromRequest で 401 未認証を弾く）。
- **結果**: お知らせの公開はスタッフ以上に限定され、利用者のみのアカウントでは変更できない。

#### その他（イベント一覧・申込・マイページ・スケジュール・マイQR）

- **認証**: **getUserEmailFromRequest(event)** で「認証済みであること」のみを要求。  
  - 自分の申込・自分の QR・自分のスケジュールなどは、すべてリクエストの `email`（トークン由来）でスコープしている。
- **結果**: 認証されていないアクセスは 401、認証済みなら役割に依存しない共通機能として利用できる。

---

## 2. リスク対応状況：権限マトリックスに基づく不正アクセス・権限越えの防止

### 2.1 役割定義（role_flag）

| role_flag | 役割名 | 想定ユーザー |
|-----------|--------|----------------|
| 1 | 利用者 | 参加者・生徒 |
| 2 | スタッフ | 受付・運営 |
| 3 | 管理者 | システム管理者 |

権限の**唯一の正**は DB の `users.role_flag` である。トークンには `roleFlag` が含まれるが、バックエンドは **getUserRoleFlag(email)** で DB を都度参照し、改ざんやクライアントの偽装に依存しない。

### 2.2 API 別 権限マトリックス（誰が何を実行できるか）

| 機能・API | 利用者(1) | スタッフ(2) | 管理者(3) | 未認証 | 実装上のチェック |
|-----------|------------|-------------|-----------|--------|-------------------|
| POST /v1/users/login | ○ | ○ | ○ | ○ | なし（公開） |
| POST /v1/users/register | ○ | ○ | ○ | ○ | なし（公開） |
| GET /v1/users/me | ○（自分） | ○（自分） | ○（自分） | × | getUserEmailFromRequest → 401 |
| GET /v1/users/me/qr | ○（自分） | ○（自分） | ○（自分） | × | 同上 |
| GET /v1/events | ○ | ○ | ○ | × | 同上 |
| GET /v1/users/registrations | ○（自分） | ○（自分） | ○（自分） | × | 同上 + スコープ本人 |
| GET /v1/users/attendance/history | ○（自分） | ○（自分） | ○（自分） | × | 同上 + スコープ本人 |
| GET /v1/users/schedule | ○（自分） | ○（自分） | ○（自分） | × | 同上 + スコープ本人 |
| POST /v1/users/attendance（QR打刻） | × | ○ | ○ | × | checkStaffOrAdminPermission → 403 |
| GET /v1/students/search | × | ○ | ○ | × | checkStaffOrAdminPermission → 401/403 |
| POST /v1/attendance/manual | × | ○ | ○ | × | checkStaffOrAdminPermission → 401/403 |
| GET /v1/admin/events/{id}/participants | ○（自分分のみ） | ○（全員） | ○（全員） | × | checkStaffOrAdminPermission + スコープ分岐 |
| GET /v1/admin/events（一覧） | × | × | ○ | × | checkAdminPermission → 403 |
| POST/PUT/DELETE /v1/admin/events, QR, 出席レポート | × | × | ○ | × | checkAdminPermission → 403 |
| GET /v1/admin/students, POST/PUT/DELETE, import | × | × | ○ | × | checkAdminPermission → 403 |
| GET/POST/PUT/DELETE /v1/admin/staffs, invite | × | × | ○ | × | checkAdminPermission → 403 |
| GET /v1/admin/reports/events/{id}/csv | × | × | ○ | × | checkAdminPermission → 403 |
| GET /v1/news（一覧） | ○ | ○ | ○ | × | getUserEmailFromRequest → 401 |
| POST/PUT/DELETE /v1/admin/news | × | ○ | ○ | × | checkStaffOrAdminPermission → 403 |

### 2.3 不正アクセス・権限越えの防止策の整理

| リスク | 対策 |
|--------|------|
| **未認証での API 利用** | 認証が必要なエンドポイントでは必ず `getUserEmailFromRequest` または `checkStaffOrAdminPermission` / `checkAdminPermission` を最初に実行。トークンなし・不正の場合は 401 を返し、処理を続行しない。 |
| **利用者が管理者 API を叩く** | 管理者専用 API はすべて `checkAdminPermission` でガード。role_flag !== 3 の場合は 403 を返す。 |
| **利用者がスタッフ API を叩く** | 手動打刻・生徒検索・QR 打刻・お知らせ CRUD 等は `checkStaffOrAdminPermission` でガード。role_flag が 2 または 3 でない場合は 403。 |
| **他者のデータ閲覧・操作** | 打刻履歴・申込・スケジュール・マイQR 等は、トークンから取得した `email` のみを WHERE 条件に使い、他者のレコードを返さない。参加者一覧は `isStaffOrAdmin` で「全員」と「自分だけ」を分岐。 |
| **打刻対象の取り違え** | 手動打刻では「打刻対象が users に存在し、かつ role_flag = 1（利用者）」であることを検証。スタッフ・管理者を生徒として打刻できないようにしている。 |
| **役割の不正変更** | スタッフの招待・権限変更・「利用者に変更」はすべて `checkAdminPermission` で管理者のみに限定。 |
| **トークン改ざん・偽装** | 権限判定にトークン内の roleFlag は使わず、必ず DB の `getUserRoleFlag(email)` を参照。email はトークンの署名・Payload から取得するため、改ざん時は検証失敗または別ユーザーとして扱われる。 |

---

## 3. 運用ルール：新機能実装時に遵守すべきセキュリティ実装ルール

以下のルールは、WBS に沿って新規 API や画面を追加する際に**必須**とする。

### 3.1 バックエンド（API）

1. **認証の義務化**  
   - ログイン・利用者登録など「意図的に公開」する API を除き、**すべてのエンドポイントで認証を実施する**。  
   - トークンは `Authorization: Bearer <token>` で受け取り、`getUserEmailFromRequest(event)` で email を取得。  
   - email が取得できない場合は **401 Unauthorized** を返し、処理を続行しない。

2. **権限判定は DB の role_flag に依存する**  
   - 権限の可否は **getUserRoleFlag(email)** で取得した `role_flag` に基づいてのみ行う。  
   - クライアントから送られた roleFlag や、トークン Payload の roleFlag だけでは許可しない。

3. **共通関数の利用**  
   - **管理者専用**の API では **checkAdminPermission(event)** をハンドラの先頭で実行する。  
     - 未認証 → 401、認証済みだが管理者でない → 403。  
   - **スタッフまたは管理者**でよい API では **checkStaffOrAdminPermission(event)** を実行する。  
     - 未認証 → 401、利用者のみ → 403。  
   - 「認証済みなら誰でもよい」API では **getUserEmailFromRequest(event)** で email を取得し、null なら 401。

4. **スコープの限定**  
   - 「自分のデータのみ」を返す API では、レスポンス・SQL の WHERE 条件に**必ずトークンから得た email（または userId）**だけを使う。  
   - パスパラメータやクエリで「他人の email/userId」が渡されても、**認証ユーザー本人のデータのみ**返すか、403/404 で拒否する。

5. **新規 Lambda での auth の参照**  
   - 新規 Lambda を追加する場合は、`backend/shared/utils/auth.ts` および `role-check.ts` を正しく参照し、**各 function の shared/utils/auth** はビルド・デプロイで共有コピーと整合させる。  
   - 権限チェックを「手書きの 5 行」で重複実装せず、**checkAdminPermission** / **checkStaffOrAdminPermission** のいずれかで統一する。

6. **エラーレスポンスの統一**  
   - 認証失敗は **401**、権限不足は **403** を使い分ける。  
   - メッセージは `errorResponse('UNAUTHORIZED', '...', 401)` または `errorResponse('FORBIDDEN', '...', 403)` で統一する。

7. **入力値の検証**  
   - event_id や limit/offset 等は数値化し、SQL には**プレースホルダ（?）**のみでバインドする。  
   - 文字列の検索条件で LIKE を使う場合は、ワイルドカードのエスケープを行う（SQL インジェクション対策）。

### 3.2 フロントエンド（Next.js）

1. **認証必須ページのガード**  
   - 認証が必要な画面では、**AuthContext** の `isAuthenticated` を参照し、未認証の場合は **/login** へリダイレクトする。  
   - 役割による制御が必要な画面では **RoleGuard** で `allowedRoles` と `redirectTo` を指定する。

2. **管理者・スタッフ専用ルート**  
   - `app/admin/*` は管理者のみにし、レイアウトで **RoleGuard allowedRoles={[UserRole.ADMIN]}** をかける。  
   - `app/staff/*` はスタッフ以上とし、**allowedRoles={[UserRole.STAFF, UserRole.ADMIN]}** でガードする。

3. **API 呼び出し時のトークン**  
   - 認証が必要な API には、**api-client** が localStorage の `authToken` を `Authorization: Bearer` で付与していることを前提とする。  
   - 新規 API を呼ぶ場合も同じクライアントを使い、トークンを別経路で送らない。

4. **401 時のクライアント挙動**  
   - API が 401 を返した場合は、**localStorage をクリアしてログイン画面へリダイレクト**する実装を推奨する（api-client または AuthContext で一元処理）。

### 3.3 ドキュメント・設計

1. **権限の明記**  
   - 新規 API を追加する際は、本ドキュメントの「2.2 API 別 権限マトリックス」に**利用者/スタッフ/管理者/未認証の可否**を 1 行追加する。  
   - 仕様書（API.md や実装案）にも「認証」「必要な権限（管理者のみ / スタッフ以上 / 認証済みなら誰でも）」を必ず書く。

2. **WBS との整合**  
   - 新機能は WBS の該当フェーズ（例: 実装 FE/BE）にタスクを反映し、セキュリティ要件（どのロールが触れるか）をタスク説明に含める。  
   - 権限マトリックスにない新ロールや新 API を増やす場合は、本セキュリティ設計の見直しを行う。

---

## 参照

- [WBS](../../WBS.md) — 工程・進捗の絶対基準  
- [FE_UI_UX_DESIGN_2-1.md](./FE_UI_UX_DESIGN_2-1.md) — 役割とアクセス方針・画面構成  
- [FE_2-2_LOGIN_AUTH_IMPLEMENTATION_PLAN.md](./FE_2-2_LOGIN_AUTH_IMPLEMENTATION_PLAN.md) — 認証状態の保持・役割別リダイレクト  
- [it_test_spec.md](./it_test_spec.md) — 権限チェックを含む結合テスト項目  
