# テストユーザーの作成方法

## 管理者アカウントの作成（推奨）

### 方法A: スクリプトで作成（backend の .env で DB 設定済みの場合）

```bash
cd apps/qr-attendance/backend
npm run create-admin
```

- デフォルトで **admin@example.com** / **admin123** の管理者が作成されます。
- 既に同じメールのユーザーがいる場合は、そのユーザーが管理者（role_flag=3）に更新されます。

任意のメール・パスワードで作成する場合:

```bash
node scripts/create-admin.js あなたのメール@example.com パスワード
```

例:

```bash
node scripts/create-admin.js admin@mycompany.com MySecurePass1
```

### 方法B: MySQLで直接作成

```bash
mysql -u root -p qr_attendance
```

MySQLに接続後、以下を実行（パスワードは SHA-256 ハッシュ）:

```sql
-- 管理者ユーザーを作成（パスワード: admin123）
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag)
VALUES (
  'admin@example.com',
  SHA2('admin123', 256),
  '管理者',
  'カンリシャ',
  '090-1234-5678',
  3  -- 3=管理者
);

-- 既存ユーザーを管理者にする場合
UPDATE users SET role_flag = 3 WHERE email = 'nkmr1201@gmail.com';
```

---

```bash
mysql -u root -p qr_attendance
```

MySQLに接続後、以下を実行：

```sql
-- テスト用管理者ユーザーを作成
-- パスワード: admin123（SHA-256ハッシュ）
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag) 
VALUES (
  'admin@example.com', 
  SHA2('admin123', 256),
  '管理者', 
  'カンリシャ', 
  '090-1234-5678', 
  3  -- 3=管理者
);

-- テスト用一般ユーザーを作成
-- パスワード: user123（SHA-256ハッシュ）
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag) 
VALUES (
  'user@example.com', 
  SHA2('user123', 256),
  '利用者', 
  'リヨウシャ', 
  '090-1111-2222', 
  1  -- 1=利用者
);

-- 確認
SELECT email, name_kanji, role_flag FROM users;
```

### 方法2: ユーザー登録APIを使用

フロントエンドの登録画面からユーザーを作成：

1. ブラウザで `http://localhost:3000/register` にアクセス
2. フォームに入力して登録
3. データベースにユーザーが作成される

**注意**: 登録APIもCognitoを使用している場合は、同様の修正が必要です。

### 方法3: 既存のユーザーのパスワードを確認

```sql
-- ユーザーのパスワードを確認（ハッシュ値が表示される）
SELECT email, password, name_kanji FROM users WHERE email = 'nkmr1201@gmail.com';

-- パスワードをリセット（例: password123）
UPDATE users 
SET password = SHA2('password123', 256) 
WHERE email = 'nkmr1201@gmail.com';
```

## ログイン情報

作成したユーザーでログイン：

- **管理者**: 
  - メールアドレス: `admin@example.com`
  - パスワード: `admin123`

- **一般ユーザー**: 
  - メールアドレス: `user@example.com`
  - パスワード: `user123`

## パスワードのハッシュ化について

ローカル開発環境では、SHA-256を使用してパスワードをハッシュ化しています。

```sql
-- SHA-256ハッシュでパスワードを設定
UPDATE users SET password = SHA2('your_password', 256) WHERE email = 'user@example.com';
```

**注意**: 本番環境では、より安全なbcryptなどのアルゴリズムを使用することを推奨します。
