# タスク 2-2. ログイン・認証画面 — 実装案

**WBS**: 実装 (Coding) - FE（2-2 対応中）  
**タスク**: 2-2. ログイン・認証画面  
**前提**: Next.js App Router、既存バックエンド POST /v1/users/login（トークン＋roleFlag 返却）、FE_UI_UX_DESIGN_2-1.md の画面構成に従う。

---

## 1. 現状の整理

### 1.1 認証フロー（バックエンド）

- **POST /v1/users/login**（body: `{ email, password }`）
  - 成功時: `{ token, refreshToken, userId, userName, orgId, roleFlag }`（status 200）
  - ローカル: DB のパスワードハッシュ照合後、**Base64 の簡易トークン**（payload: `{ email, roleFlag, exp }`）を返却
  - 本番想定: Cognito 認証と連携可能（現状は DB 認証でトークン発行）
- **roleFlag**: 1=利用者, 2=スタッフ, 3=管理者。フロントはこの値でリダイレクト・表示を制御する。

### 1.2 フロントエンドの現状

| 対象 | 内容 |
|------|------|
| **認証状態の保持** | `AuthContext`（React Context）。`localStorage`: `authToken`, `refreshToken`, `roleFlag`。Cognito 設定がある場合は `getCurrentUser()` も利用。 |
| **ログイン画面** | `/login` — メール・パスワード送信 → `apiClient.login()` → トークン・roleFlag を localStorage に保存 → `/home` へリダイレクト |
| **API 呼び出し** | `api-client.ts` が `Authorization: Bearer ${localStorage.authToken}` を付与 |
| **役割による制御** | `RoleGuard`: `allowedRoles` に応じて未認証なら `/login`、権限不足なら `redirectTo` へ。`useAuth()` で `role`, `isAdmin`, `isStaff` を取得。 |
| **ホーム** | `/home`（HomeClient）で未認証なら `/login` へ。認証済みなら role に応じたメニュー（管理者・スタッフ・利用者）を表示。 |

---

## 2. 認証状態の保持（Amplify/Cognito と Next.js）

### 2.1 二重モードの維持

現在の設計は **「バックエンドAPI認証を主軸」「Cognito はオプション」** になっている。

| 環境 | 認証の主軸 | トークン | 役割(roleFlag) |
|------|------------|----------|----------------|
| **ローカル（Cognito 未設定）** | POST /v1/users/login のみ | API が返す Base64 トークンを localStorage に保存 | ログイン応答の `roleFlag` を localStorage に保存し、初回以降はそこから復元 |
| **本番（Cognito 設定あり）** | API ログイン ＋ 必要に応じて Cognito signIn | 同上。Cognito の IdToken ではなく **API が返す token** を API 呼び出しに使用 | 同上（API の roleFlag を信頼する） |

**方針**: この二重モードを維持する。理由は以下。

- バックエンドが「DB の users テーブル＋role_flag」を正とするため、**API の token と roleFlag が唯一の権威**とする。
- Cognito は「Amplify UI や他サービスとの連携」「本番の IdToken 発行」用に残し、**フロントの認証状態の主軸は localStorage の authToken と roleFlag** のままにする。

### 2.2 認証状態の保持場所（Next.js 上）

- **クライアント側**
  - **localStorage**: `authToken`, `refreshToken`, `roleFlag`（現状どおり）。SSR では参照しない（`typeof window !== 'undefined'` でガード済み）。
  - **React state（AuthContext）**: `user`, `roleFlag`, `isLoading`, `isAuthenticated`, `role`, `isAdmin`, `isStaff`。マウント時に `checkAuth()` で localStorage または Cognito から復元。
- **サーバー側（SSR）**
  - 認証必須ページは **クライアントコンポーネント** でラップし、`useEffect` 内で `isAuthenticated` を見てリダイレクトする現状の方式でよい。Next.js のサーバーでは **Cookie にトークンを載せない** ため、SSR では「認証済みか」を判定しない（クライアントで判定してリダイレクト）。

### 2.3 初回読み込み・リロード時の流れ

1. **App マウント** → `AuthProvider` の `useEffect` で `checkAuth()` 実行。
2. **checkAuth()**  
   - Cognito 設定あり: `getCurrentUser()` で user を取得。**roleFlag は API に依存するため**、引き続き **localStorage の roleFlag** を読む。  
   - Cognito 設定なし: localStorage の `authToken` があれば Base64 デコードして `user`（email 等）を組み立て、`roleFlag` は localStorage から取得。
3. **isLoading → false** の後、各ページで `useAuth()` の `isAuthenticated` / `role` を参照し、未認証なら `/login`、権限不足なら指定の redirectTo へ。

**重要**: roleFlag は **ログインAPIのレスポンスでしか確定しない** ため、Cognito のみで「管理者か」は判断しない。常に **localStorage の roleFlag**（および API ログイン時に設定した値）を正とする。

### 2.4 トークン期限切れ・無効化

- 現状: トークン期限切れや 401 時の「自動ログアウト」や「ログイン画面へリダイレクト」は、**api-client の 401 をキャッチした箇所で** 実装するのがよい。
- 推奨: `api-client.request()` 内で **response.status === 401** のとき、`localStorage` をクリアし、`window.location.href = '/login'`（または AuthContext の `logout()` を呼んでから `/login` へ）でリダイレクトする。AuthContext に `onUnauthorized` コールバックを渡す形でも可。

---

## 3. 役割（Role）に応じたリダイレクト制御

### 3.1 ログイン後のリダイレクト先

- **現状**: ログイン成功後は一律 `/home`。
- **推奨（そのまま）**: **全ロールとも `/home` にリダイレクト** でよい。`/home` が役割別メニュー（利用者・スタッフ・管理者）を出しているため、役割に応じた選択はホームで行う形で十分。

オプションで「管理者は /admin/events に飛ばす」等にしてもよいが、WBS 上は「ログイン・認証画面」の完了が主目的なので、**ログイン → /home** を標準とする。

### 3.2 未認証時のリダイレクト

- **認証必須ページ**（`/home`, `/events`, `/staff/*`, `/admin/*` 等）で、`isAuthenticated === false` かつ `!isLoading` のとき **`/login` へ push**。  
  `returnTo` 等で元の URL を保持し、ログイン後に戻すかは任意（2-2 では必須としない）。

### 3.3 役割別アクセス制御（ルート保護）

| 種別 | 制御方法 | 例 |
|------|----------|-----|
| **認証済みなら誰でも** | ページ内で `!isAuthenticated` なら `/login` へ | `/home`, `/events`, `/my-qr` |
| **スタッフ以上** | `RoleGuard` で `allowedRoles={[UserRole.STAFF, UserRole.ADMIN]}`、不足時は `redirectTo="/home"` | `/staff/attendance`, `/staff/manual` |
| **管理者のみ** | `RoleGuard` で `allowedRoles={[UserRole.ADMIN]}`、不足時は `redirectTo="/home"` | `/admin/events`, `/admin/students` |

- **実装場所**: 各ページを `RoleGuard` でラップするか、**レイアウト**で実施する。  
  - 例: `app/admin/layout.tsx` で `RoleGuard allowedRoles={[UserRole.ADMIN]}` をかけると、`/admin/*` 全体が管理者のみになる。
  - `app/staff/layout.tsx` で `allowedRoles={[UserRole.STAFF, UserRole.ADMIN]}` とすると、スタッフ・管理者のみ。

### 3.4 リダイレクトのタイミング

- **クライアント側のみ**: `useEffect` 内で `router.push('/login')` または `redirectTo`。  
  `isLoading` が true の間はリダイレクトせず、ローディング表示にする（現状の RoleGuard と同じ）。
- **ミドルウェアは使わない**: トークンが localStorage にあるため、Next.js の Middleware では「認証済みか」を判定しづらい。**クライアントの AuthContext + RoleGuard に一本化**する。

---

## 4. 実装する画面・コンポーネント（2-2 の範囲）

| 項目 | 内容 |
|------|------|
| **ログイン画面** | 既存 `/login` を維持。メール・パスワード送信 → API ログイン → token/roleFlag 保存 → `/home` へ。エラー表示・バリデーション（必須・形式）を必要に応じて強化。 |
| **新規登録画面** | 既存 `/register` を維持。利用者セルフ登録。登録後はログインさせるか、そのままログイン API を呼んで `/home` へ送るかは仕様次第。 |
| **ホーム** | 既存 `/home`。未認証なら `/login`。認証済みなら role に応じたメニュー表示。ログアウトで localStorage クリア＋`/login` へ。 |
| **ルート `/`** | 未認証なら `/login`、認証済みなら `/home` へリダイレクト（既存 or 明示実装）。 |
| **認証状態の永続化** | AuthContext + localStorage（authToken, roleFlag）。Cognito あり時も roleFlag は API ログイン結果を信頼。 |
| **役割別リダイレクト** | ログイン後は `/home`。各ページは RoleGuard またはページ内の `useAuth()` で未認証→`/login`、権限不足→`/home` 等。 |
| **401 時の扱い** | api-client で 401 を検出したら localStorage クリア＋ログインへリダイレクトする処理を追加することを推奨。 |

---

## 5. 技術的な詳細（実装時のポイント）

### 5.1 AuthContext の見直し（必要なら）

- **checkAuth()**: Cognito 設定ありのとき `getCurrentUser()` で user をセット。**roleFlag は必ず localStorage から読む**（Cognito のカスタム属性に roleFlag があればそれを使う方式も可だが、現状は API が正なので localStorage でよい）。
- **login()**: 現状どおり API ログイン → token / roleFlag を localStorage に保存。Cognito 設定ありなら `signIn` を試行（失敗しても API 成功なら続行）。その後に `setUser` / `setRoleFlag` で state を更新。
- **logout()**: `signOut()`（Cognito）、localStorage クリア、`setUser(null)`, `setRoleFlag(null)`。

### 5.2 トークンの形式（バックエンド）

- ローカル: Base64(JSON({ email, roleFlag, exp }))。フロントは **検証しない**（バックエンドが検証）。フロントは「token があれば Authorization に付与」と「roleFlag を表示・リダイレクトに使う」だけ。

### 5.3 ルート保護の統一

- **推奨**: `app/admin/layout.tsx` で `RoleGuard allowedRoles={[UserRole.ADMIN]} redirectTo="/home"` をかける。`app/staff/layout.tsx` で `allowedRoles={[UserRole.STAFF, UserRole.ADMIN]} redirectTo="/home"`。  
  認証のみ必要なページは、ページコンポーネント内で `!isAuthenticated && router.push('/login')` でよい（既存の HomeClient と同様）。

### 5.4 ログイン画面のガード

- `/login` は **認証済みなら `/home` にリダイレクト** すると UX がよい。`LoginPage` の `useEffect` で `isAuthenticated === true` なら `router.push('/home')`。

---

## 6. 2-2 完了の定義（受け入れ条件）

- ログイン画面からメール・パスワードで API ログインでき、トークン・roleFlag が localStorage と AuthContext に正しく保持される。
- 認証済みユーザーが `/home` で役割に応じたメニューを見られる（利用者・スタッフ・管理者で表示が異なる）。
- 未認証で保護ページにアクセスすると `/login` にリダイレクトされる。
- スタッフが管理者専用 URL にアクセスした場合、`redirectTo`（例: `/home`）にリダイレクトされる。
- ログアウトで localStorage がクリアされ、再アクセス時は未認証として扱われる。
- （推奨）API が 401 を返したときにクライアント側でログアウトし、ログイン画面へリダイレクトする。

---

## 7. 次のタスクとの接続

- 2-2 完了後、2-3 以降で「手動打刻画面」「生徒名簿管理」等を実装する際、それらのページは `app/staff/*` / `app/admin/*` に配置し、上記の RoleGuard で保護する。  
  認証・役割の制御は本 2-2 の仕様を共通前提とする。
