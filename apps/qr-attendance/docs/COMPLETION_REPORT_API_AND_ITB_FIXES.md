# 作業完了報告書（APIエラー解消・打刻重複防止・ログイン復旧・導線修正）

**報告日**: 2026年3月13日  
**対象**: QRコード打刻システム（apps/qr-attendance）  
**元指示**: 複数回のチャットにわたる指示の集約報告

---

## 1. APIエラー解消・エラーハンドリング徹底（第1回指示）

### 1.1 DB不整合（`Unknown column 'is_published'`）

| 項目 | 内容 |
|------|------|
| 確認結果 | 接続先DBの `news` テーブルに **`is_published`** と **`announcement_type`** は既に存在することを確認済み。 |
| 対応 | 別環境で同エラーが出る場合は、その環境で `database/migrations/005_add_news_is_published_and_type.sql` を実行するか、`backend/scripts/run-migration-005.js` を実行すること。 |

### 1.2 参加申込一覧（6.4.6）の400エラー解消

| 項目 | 内容 |
|------|------|
| 原因 | 利用者用API `GET /v1/users/registrations` が、非管理者で `email` クエリ未送信の場合に 400 を返していた。 |
| バックエンド修正 | `backend/functions/users/registrations/index.js` および `index.ts` を修正。非管理者で `email` 未送信の場合は、認証トークンから取得した `requestEmail` で「自分の申込」のみを返すように変更。 |
| フロント修正 | `frontend/src/app/user/registrations/page.tsx` で、`email` は取得できる場合のみクエリに含め、未取得時は `limit`/`offset` のみでAPIを呼ぶように変更。 |

### 1.3 エラーハンドリングの徹底

| 画面 | 修正内容 |
|------|----------|
| ホーム（`HomeClient.tsx`） | お知らせ取得失敗時に `newsError` を表示。失敗時は `news` を空にし、古いお知らせを表示しない。 |
| お知らせ管理（`admin/announcements/page.tsx`） | 一覧取得エラー時に `setList([])` と `setPagination(...)` でクリアし、エラー時は古い一覧を表示しない。 |
| 利用者・管理者の参加申込一覧 | 初回ロード（`offset === 0`）でエラーになった場合、一覧とページネーションをクリアするように変更。 |

**確認**: ホーム・お知らせ管理・参加申込一覧をリロードし、APIエラー時は白画面ではなくエラーメッセージが表示され、古いデータが残らないことを確認すること。

---

## 2. 打刻重複の解消と二重打刻防止（第2回指示）

### 2.1 DBの重複削除

| 項目 | 内容 |
|------|------|
| スクリプト | `backend/scripts/dedup-attendance-and-add-unique.js` を新規作成・実行。 |
| 実行結果 | 同一 `(event_id, email)` の重複が **3グループ・計9行** 存在。`log_id` が最小の1件を残し、**9行を削除**。 |
| 制約追加 | `attendance_logs` に **UNIQUE KEY `uk_event_email` (event_id, email)** を追加済み。 |

### 2.2 二重打刻の防止（バックエンド）

| 対象 | 内容 |
|------|------|
| ファイル | `backend/functions/users/attendance/index.js` および `index.ts`（スタッフスキャン・旧方式の両方）。 |
| ロジック | ① 同一ユーザー・同一イベントで、既に入室打刻があり **10秒以内** の再リクエストの場合は新規INSERTせず、既存レコードの情報で 200 を返す。② INSERT 時に UNIQUE 違反（`ER_DUP_ENTRY` / 1062）となった場合は、既存の打刻レコードを取得し、その内容で 200 を返す（「入室打刻は既に記録済みです（二重打刻防止）」）。 |

### 2.3 参加者一覧の重複表示対策

| 項目 | 内容 |
|------|------|
| ファイル | `backend/functions/admin/events/participants/index.js` |
| 修正 | `attendance_logs` との JOIN を、`(event_id, email)` ごとに `MAX(log_id)` の1行のみを参照するサブクエリに変更。重複データが残っていても参加者一覧は **1人1行** で表示される。 |

### 2.4 ドキュメント更新

- **docs/TEST_MANAGEMENT_SHEET.md**: 「二重打刻防止の検証」セクションを追加（DB重複削除・API防止・連打テストの確認項目）。
- **docs/TEST_SCENARIO_ITB.md**: シナリオ2に「二重打刻防止の確認」を追加（連打時に1人1件のみ表示されること等）。
- **database/README.md**: 既存データに重複がある場合の `dedup-attendance-and-add-unique.js` の実行手順を追記。

**確認方法**: 同一生徒・同一イベントで打刻を連打し、参加者一覧・出席レポート・CSV に1人1件のみ表示され、2回目以降のAPIが「入室打刻は既に記録済みです」で返ることを確認すること。

---

## 3. 管理者アカウントのログイン復旧（第3回指示）

### 3.1 パスワード再設定

| 項目 | 内容 |
|------|------|
| スクリプト | `backend/scripts/reset-admin-password.js` を新規作成・実行。 |
| 対象メール | `admin@example.com`, `it-admin@example.com`, `it-staff@example.com`, `it-user@example.com` |
| 新パスワード | **`password123`**（SHA-256 でハッシュし、`users.password` を上書き）。 |
| 結果 | 上記4アカウントすべて更新済み。 |

### 3.2 認証ロジックの点検（Too many connections）

| 項目 | 内容 |
|------|------|
| 認証方式 | ローカルでは Bcrypt ではなく **SHA-256** でパスワードをハッシュし、DBのハッシュと比較。 |
| 修正 | DBの「Too many connections」等で例外が発生した場合、401 ではなく **503** を返すように変更。`index.js` および `index.ts` で、`ER_CON_COUNT_ERROR` または `error.message` に `"Too many connections"` が含まれる場合は `SERVICE_UNAVAILABLE` で 503 を返す。 |

### 3.3 ログイン試行の結果

| メール | パスワード | 結果 | 備考 |
|--------|------------|------|------|
| it-admin@example.com | password123 | 200 OK | token / refreshToken 取得、roleFlag: 3 |
| it-staff@example.com | password123 | 200 OK | token / refreshToken 取得、roleFlag: 2 |
| admin@example.com | password123 | 200 OK | token / refreshToken 取得、userName: 管理者、roleFlag: 3 |

API経由でログイン成功し、有効なトークンが返ることを確認済み。

---

## 4. イベント一覧への「出席確認」導線追加（第4回指示）

### 4.1 スタッフ専用リンクの追加

| 項目 | 内容 |
|------|------|
| ファイル | `frontend/src/app/events/page.tsx` |
| 修正 | `useAuth()` から `isStaff` と `isAdmin` を取得し、`showAttendanceLink = isStaff || isAdmin` で判定。**スタッフまたは管理者**でログインしている場合のみ、各イベントカード内に **「出席確認画面へ」** ボタンを表示。 |
| 配置 | 各カードの「詳細・申し込む」の下に区切り線を設け、その下にオレンジ色（amber-500）のボタン「出席確認画面へ」を配置。リンク先は `/admin/events/[eventId]/participants`。タップ領域は `min-h-[44px]` で 44px 以上を確保。 |

### 4.2 URLの固定とスタッフの閲覧可否

| 項目 | 内容 |
|------|------|
| 出席確認画面のURL | もともと **`/admin/events/[eventId]/participants`** に統一済み。 |
| ガード | `frontend/src/app/admin/events/[eventId]/participants/page.tsx` の `RoleGuard` は `allowedRoles={[UserRole.USER, UserRole.STAFF, UserRole.ADMIN]}` のため、**スタッフでも閲覧可能**。middleware は存在せず、追加修正は不要。 |

### 4.3 ボタン配置の証明

- **表示条件**: ログインユーザーがスタッフ（role_flag=2）または管理者（role_flag=3）のときのみ表示。
- **位置**: 各イベントカードの**最下部**。カード本体（イベント名・日時・場所・概要・「詳細・申し込む」）の下に薄い区切り線を挟み、その直下に「出席確認画面へ」ボタンを1つ配置。
- **見た目**: 角丸のオレンジボタン。ホバーでやや濃いオレンジ（amber-600）に変化。

**確認手順**: スタッフ（例: it-staff@example.com / password123）でログイン → 「イベント一覧」（`/events`）を開く → 各カード下部に「出席確認画面へ」が表示され、クリックで `/admin/events/[eventId]/participants` に遷移することを確認すること。

---

## 5. 変更ファイル一覧

### バックエンド

| ファイル | 変更内容 |
|----------|----------|
| `functions/users/registrations/index.js` | 非管理者で email 未送信時は認証ユーザーで絞るよう変更。 |
| `functions/users/registrations/index.ts` | 上記に合わせて認証付きの同一ロジックに統一。 |
| `functions/users/attendance/index.js` | 二重打刻防止（10秒以内の重複・ER_DUP_ENTRY 捕捉）。 |
| `functions/users/attendance/index.ts` | 上記に合わせて二重打刻防止を追加。 |
| `functions/users/login/index.js` | Too many connections 時に 503 を返す処理を追加。 |
| `functions/users/login/index.ts` | 上記に合わせて 503 処理を追加。 |
| `functions/admin/events/participants/index.js` | 参加者一覧で attendance_logs を1行/人にするサブクエリに変更。 |
| `scripts/dedup-attendance-and-add-unique.js` | **新規**。attendance_logs の重複削除と UNIQUE 追加。 |
| `scripts/reset-admin-password.js` | **新規**。管理者・スタッフ等のパスワードを password123 にリセット。 |

### フロントエンド

| ファイル | 変更内容 |
|----------|----------|
| `app/HomeClient.tsx` | お知らせ取得エラー時にメッセージ表示・古いデータを表示しない。 |
| `app/admin/announcements/page.tsx` | 一覧取得エラー時にリストをクリア。 |
| `app/admin/registrations/page.tsx` | 初回ロードエラー時に一覧・ページネーションをクリア。 |
| `app/user/registrations/page.tsx` | email はある場合のみAPIに渡す。初回ロードエラー時に一覧をクリア。 |
| `app/events/page.tsx` | スタッフ/管理者時に各カードに「出席確認画面へ」ボタンを追加。 |

### ドキュメント・DB

| ファイル | 変更内容 |
|----------|----------|
| `docs/TEST_MANAGEMENT_SHEET.md` | 二重打刻防止の検証セクションを追加。 |
| `docs/TEST_SCENARIO_ITB.md` | シナリオ2に二重打刻防止の確認を追加。 |
| `database/README.md` | 重複データがある場合の dedup スクリプト実行手順を追記。 |
| `docs/COMPLETION_REPORT_API_AND_ITB_FIXES.md` | **本報告書**。 |

---

## 6. テスト・確認のためのアカウント

| メール | パスワード | 役割 |
|--------|------------|------|
| it-admin@example.com | password123 | 管理者 |
| it-staff@example.com | password123 | スタッフ |
| it-user@example.com | password123 | 利用者 |
| admin@example.com | password123 | 管理者 |

※ 従来の `TestPass12` は、リセットスクリプト実行により無効です。

---

以上が、先ほど指示した作業の完了に係る詳細報告です。
