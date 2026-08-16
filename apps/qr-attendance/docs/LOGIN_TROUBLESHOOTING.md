# ログインできない問題の解決方法

## 問題の症状

- ブラウザで `http://localhost:3000/login` にアクセスできる
- ログインフォームが表示される
- ログインボタンをクリックすると「ネットワークエラー: サーバーに接続できません」と表示される
- Chrome DevToolsのコンソールに `ERR_CONNECTION_REFUSED` エラーが表示される

## 原因

バックエンドAPIサーバー（`http://localhost:3001`）が起動していないため、フロントエンドがAPIに接続できません。

## 解決手順

### ステップ1: 必要なパッケージのインストール

**新しいターミナルウィンドウを開いて**以下を実行：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm install --save-dev ts-node nodemon
```

### ステップ2: ログインLambda関数のビルド

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend/functions/users/login
npm install
npm run build
```

### ステップ3: 環境変数の確認

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
cat .env
```

`.env`ファイルが存在しない、または設定が不完全な場合：

```bash
cp .env.example .env
# .envファイルを編集して、データベース接続情報を設定
```

最低限必要な設定：
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=あなたのMySQLパスワード
DB_NAME=qr_attendance
DB_SSL=false
```

### ステップ4: データベースの確認

```bash
# MySQLが起動しているか確認
mysql.server status

# データベースが存在するか確認
mysql -u root -p -e "SHOW DATABASES LIKE 'qr_attendance';"
```

データベースが存在しない場合：
```bash
mysql -u root -p
CREATE DATABASE qr_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

cd /Users/masahiro/MySelector/apps/qr-attendance/database
mysql -u root -p qr_attendance < schema.sql
```

### ステップ5: バックエンドサーバーの起動

**新しいターミナルウィンドウで**以下を実行：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev
```

正常に起動すると、以下のようなメッセージが表示されます：

```
🚀 Local API Server running on http://localhost:3001
📝 Available endpoints:
   POST:/v1/users/login
   POST:/v1/users/register
   ...
```

### ステップ6: ログインの再試行

1. ブラウザで `http://localhost:3000/login` にアクセス
2. メールアドレスとパスワードを入力
3. 「ログイン」ボタンをクリック

## 動作確認

### バックエンドサーバーが起動しているか確認

```bash
# 別のターミナルで
curl http://localhost:3001/v1/users/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

エラーが返ってくる場合は正常です（認証エラーは想定通り）。`ERR_CONNECTION_REFUSED`が返ってくる場合は、サーバーが起動していません。

### フロントエンドの環境変数を確認

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
cat .env.local
```

`NEXT_PUBLIC_API_URL=http://localhost:3001` が設定されていることを確認してください。

## よくあるエラーと解決方法

### エラー: `Cannot find module 'ts-node'`

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm install --save-dev ts-node nodemon
```

### エラー: `Port 3001 is already in use`

```bash
# ポート3001を使用しているプロセスを確認
lsof -ti:3001

# プロセスを終了
lsof -ti:3001 | xargs kill -9

# 再度起動
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev
```

### エラー: `Handler not found`

Lambda関数がビルドされていません。該当するLambda関数をビルドしてください：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend/functions/users/login
npm install
npm run build
```

### エラー: データベース接続エラー

1. MySQLが起動しているか確認
2. `.env`ファイルの設定を確認
3. データベースが作成されているか確認

## 開発時の推奨構成

### ターミナル1: フロントエンド
```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
npm run dev
```

### ターミナル2: バックエンド
```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev
```

両方のサーバーが起動している状態で、ブラウザからアクセスしてください。

## 次のステップ

ログインが成功したら：

1. 管理者機能（生徒管理・スタッフ管理）をテスト
2. イベント管理機能をテスト
3. QRコード打刻機能をテスト
