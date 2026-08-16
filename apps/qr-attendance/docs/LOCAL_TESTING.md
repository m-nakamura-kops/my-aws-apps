# ローカル環境での動作確認ガイド

## 概要

このガイドでは、QRコード打刻システムをローカル環境で動作確認する手順を説明します。

## 前提条件

- Node.js 18.x以上
- MySQL/MariaDB がインストール済み
- npm または yarn

## セットアップ手順

### 1. データベースのセットアップ

#### 1-1. MySQLの起動確認

```bash
# macOSの場合
brew services start mysql
# または
mysql.server start

# MySQLの状態確認
mysql.server status
```

#### 1-2. データベースの作成

```bash
mysql -u root -p
```

MySQLに接続後、以下を実行：

```sql
CREATE DATABASE qr_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

#### 1-3. スキーマの適用

```bash
cd apps/qr-attendance/database
mysql -u root -p qr_attendance < schema.sql
```

#### 1-4. 初期データの投入（オプション）

管理者ユーザーを作成する場合：

```bash
mysql -u root -p qr_attendance
```

```sql
-- 管理者ユーザーの作成（パスワードは適宜変更してください）
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag) 
VALUES (
  'admin@example.com', 
  SHA2('admin123', 256),  -- SHA-256ハッシュ（実際のシステムでは適切なハッシュ化を使用）
  '管理者', 
  'カンリシャ', 
  '090-1234-5678', 
  3  -- 3=管理者
);
```

### 2. バックエンドのセットアップ

#### 2-1. 環境変数の設定

```bash
cd apps/qr-attendance/backend
cp .env.example .env
```

`.env`ファイルを編集：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=あなたのMySQLパスワード
DB_NAME=qr_attendance
DB_SSL=false

# Cognito設定（ローカル開発時は空欄でも可）
USER_POOL_ID=
COGNITO_CLIENT_ID=
AWS_REGION=ap-northeast-1
```

#### 2-2. 依存関係のインストール

```bash
# 共有ライブラリのインストール
cd apps/qr-attendance/backend/shared
npm install

# 各Lambda関数の依存関係をインストール
# 生徒管理API
cd ../functions/admin/students/list && npm install
cd ../create && npm install
cd ../update && npm install
cd ../delete && npm install

# スタッフ管理API
cd ../../staffs/list && npm install
cd ../invite && npm install
cd ../update && npm install
cd ../delete && npm install

# その他のLambda関数も必要に応じてインストール
cd ../../../../users/login && npm install
cd ../register && npm install
# ... など
```

#### 2-3. Lambda関数のビルド

各Lambda関数をビルド：

```bash
# 生徒管理API
cd apps/qr-attendance/backend/functions/admin/students/list && npm run build
cd ../create && npm run build
cd ../update && npm run build
cd ../delete && npm run build

# スタッフ管理API
cd ../../staffs/list && npm run build
cd ../invite && npm run build
cd ../update && npm run build
cd ../delete && npm run build
```

### 3. フロントエンドのセットアップ

#### 3-1. 環境変数の設定

```bash
cd apps/qr-attendance/frontend
cp .env.example .env.local
```

`.env.local`ファイルを編集：

```env
NEXT_PUBLIC_API_URL=http://localhost:3001

# Cognito設定（ローカル開発時は空欄でも可）
NEXT_PUBLIC_COGNITO_USER_POOL_ID=
NEXT_PUBLIC_COGNITO_CLIENT_ID=
NEXT_PUBLIC_AWS_REGION=ap-northeast-1
```

#### 3-2. 依存関係のインストール

```bash
cd apps/qr-attendance/frontend
npm install
```

#### 3-3. フロントエンドの起動

```bash
npm run dev
```

フロントエンドは `http://localhost:3000` で起動します。

### 4. バックエンドAPIサーバーの起動（ローカル開発用）

Lambda関数をローカルで実行するには、API Gatewayのローカルエミュレーターまたは簡易的なHTTPサーバーが必要です。

#### オプション1: Serverless Frameworkを使用

```bash
# Serverless Frameworkをグローバルにインストール
npm install -g serverless
npm install -g serverless-offline

# serverless.ymlを作成（必要に応じて）
# その後、ローカル実行
serverless offline start --port 3001
```

#### オプション2: 簡易的なHTTPサーバーを使用

簡単なテスト用のHTTPサーバーを作成することもできます。

## 動作確認手順

### 1. データベース接続の確認

```bash
mysql -u root -p qr_attendance -e "SHOW TABLES;"
```

以下のテーブルが表示されればOK：
- users
- events
- registrations
- attendance_logs

### 2. フロントエンドの確認

ブラウザで `http://localhost:3000` にアクセス：

- ✅ ページが表示される
- ✅ ログイン画面にリダイレクトされる（未認証の場合）

### 3. 管理者機能の確認

#### 3-1. ログイン

1. `http://localhost:3000/login` にアクセス
2. 管理者アカウントでログイン（事前に作成した管理者ユーザー）

#### 3-2. 生徒管理機能の確認

1. ホーム画面から「👥 生徒名簿管理」をクリック
2. または `http://localhost:3000/admin/students` に直接アクセス

**確認項目：**
- ✅ 生徒一覧が表示される（初期状態では空）
- ✅ 「新規生徒登録」ボタンが表示される
- ✅ 検索機能が動作する

**テスト手順：**

1. **生徒の登録**
   - 「新規生徒登録」ボタンをクリック
   - フォームに入力：
     - メールアドレス: `student1@example.com`
     - パスワード: `password123`
     - 氏名（漢字）: `山田 太郎`
     - カナ: `ヤマダ タロウ`
     - 電話番号: `090-1234-5678`
   - 「登録」ボタンをクリック
   - ✅ 登録成功メッセージが表示される
   - ✅ 一覧に生徒が追加される

2. **生徒の編集**
   - 登録した生徒の「編集」ボタンをクリック
   - 氏名を変更して「更新」ボタンをクリック
   - ✅ 変更が反映される

3. **生徒の削除**
   - 生徒の「削除」ボタンをクリック
   - 確認ダイアログで「OK」をクリック
   - ✅ 生徒が削除される

4. **検索機能**
   - 検索ボックスに「山田」と入力して検索
   - ✅ 該当する生徒が表示される

#### 3-3. スタッフ管理機能の確認

1. ホーム画面から「👔 スタッフ管理」をクリック
2. または `http://localhost:3000/admin/staffs` に直接アクセス

**確認項目：**
- ✅ スタッフ一覧が表示される（初期状態では空）
- ✅ 「スタッフ招待」ボタンが表示される
- ✅ 検索機能が動作する

**テスト手順：**

1. **スタッフの招待**
   - 「スタッフ招待」ボタンをクリック
   - フォームに入力：
     - メールアドレス: `staff1@example.com`
     - パスワード: （省略可、自動生成される）
     - 氏名（漢字）: `佐藤 花子`
     - カナ: `サトウ ハナコ`
     - 電話番号: `090-9876-5432`
   - 「招待」ボタンをクリック
   - ✅ 招待成功メッセージが表示される
   - ✅ 一覧にスタッフが追加される

2. **スタッフの編集**
   - 登録したスタッフの「編集」ボタンをクリック
   - 情報を変更して「更新」ボタンをクリック
   - ✅ 変更が反映される

3. **スタッフの削除**
   - スタッフの「削除」ボタンをクリック
   - 確認ダイアログで「OK」をクリック
   - ✅ スタッフが削除される（打刻記録がある場合は利用者に変更）

4. **検索機能**
   - 検索ボックスに「佐藤」と入力して検索
   - ✅ 該当するスタッフが表示される

### 4. APIエンドポイントの直接確認（オプション）

curlコマンドでAPIを直接テスト：

```bash
# 生徒一覧取得（管理者権限が必要）
curl -X GET "http://localhost:3001/v1/admin/students?email=admin@example.com" \
  -H "Content-Type: application/json"

# 生徒登録
curl -X POST "http://localhost:3001/v1/admin/students" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name_kanji": "テスト 太郎",
    "name_kana": "テスト タロウ",
    "tel": "090-1111-2222"
  }'

# スタッフ一覧取得
curl -X GET "http://localhost:3001/v1/admin/staffs?email=admin@example.com" \
  -H "Content-Type: application/json"

# スタッフ招待
curl -X POST "http://localhost:3001/v1/admin/invite" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@example.com",
    "name_kanji": "スタッフ 花子",
    "name_kana": "スタッフ ハナコ",
    "tel": "090-3333-4444"
  }'
```

## トラブルシューティング

### データベース接続エラー

**エラー**: `ER_ACCESS_DENIED_ERROR` または接続タイムアウト

**解決方法：**
1. MySQLが起動しているか確認：
   ```bash
   mysql.server status
   ```

2. `.env`ファイルの設定を確認：
   - `DB_HOST=localhost`
   - `DB_USER=root`
   - `DB_PASSWORD`が正しいか

3. MySQLのパスワードを確認：
   ```bash
   mysql -u root -p
   ```

### ポートが既に使用されている

**エラー**: `Port 3000 is already in use`

**解決方法：**
```bash
# ポート3000を使用しているプロセスを確認
lsof -ti:3000

# プロセスを終了
lsof -ti:3000 | xargs kill -9

# または別のポートを使用
PORT=3002 npm run dev
```

### Lambda関数のビルドエラー

**エラー**: TypeScriptコンパイルエラー

**解決方法：**
1. 依存関係を再インストール：
   ```bash
   cd apps/qr-attendance/backend/functions/admin/students/list
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

2. TypeScriptのバージョンを確認：
   ```bash
   npm list typescript
   ```

### フロントエンドのAPI呼び出しエラー

**エラー**: `Network Error` または `CORS Error`

**解決方法：**
1. `.env.local`の`NEXT_PUBLIC_API_URL`が正しいか確認
2. バックエンドAPIサーバーが起動しているか確認
3. CORS設定を確認（Lambda関数の`corsResponse()`が正しく実装されているか）

### 認証エラー

**エラー**: `FORBIDDEN` または `Admin access required`

**解決方法：**
1. 管理者権限（`role_flag=3`）のユーザーでログインしているか確認
2. データベースでユーザーの`role_flag`を確認：
   ```sql
   SELECT email, role_flag FROM users WHERE email = 'admin@example.com';
   ```

## 開発時の便利なコマンド

### データベースのリセット

```bash
# データベースを削除して再作成
mysql -u root -p -e "DROP DATABASE qr_attendance;"
mysql -u root -p -e "CREATE DATABASE qr_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
cd apps/qr-attendance/database
mysql -u root -p qr_attendance < schema.sql
```

### テストデータの投入

```sql
-- 管理者ユーザー
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag) 
VALUES ('admin@example.com', SHA2('admin123', 256), '管理者', 'カンリシャ', '090-0000-0000', 3);

-- スタッフユーザー
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag) 
VALUES ('staff@example.com', SHA2('staff123', 256), 'スタッフ', 'スタッフ', '090-1111-1111', 2);

-- 生徒ユーザー
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag) 
VALUES ('student@example.com', SHA2('student123', 256), '生徒', 'セイト', '090-2222-2222', 1);
```

### ログの確認

```bash
# フロントエンドのログ
# ブラウザの開発者ツール（F12）のコンソールを確認

# バックエンドのログ
# Lambda関数の実行ログを確認（CloudWatch Logsまたはローカルログ）
```

## 次のステップ

ローカル環境での動作確認が完了したら：

1. **AWS環境へのデプロイ**
   - [AWS環境セットアップガイド](./AWS_SETUP_GUIDE.md)を参照

2. **機能の追加開発**
   - [実装ロードマップ](./ROADMAP.md)を参照

3. **テストの実装**
   - 単体テスト、統合テストの追加
