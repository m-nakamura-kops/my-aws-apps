# バックエンドAPIサーバーの起動方法

## 問題

フロントエンドから `http://localhost:3001` に接続できないエラーが発生しています。

**エラーメッセージ**: `ERR_CONNECTION_REFUSED`

**原因**: バックエンドAPIサーバーが起動していない

## 解決方法

### ステップ1: 必要なパッケージのインストール

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm install --save-dev ts-node nodemon @types/node
```

### ステップ2: Lambda関数のビルド

ログイン機能を使用するために、ログインLambda関数をビルド：

```bash
# ログインLambda関数のビルド
cd functions/users/login
npm install
npm run build
cd ../../..
```

### ステップ3: 環境変数の設定確認

`.env`ファイルが正しく設定されているか確認：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
cat .env
```

以下の設定が必要です：
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=あなたのMySQLパスワード
DB_NAME=qr_attendance
DB_SSL=false
```

### ステップ4: バックエンドサーバーの起動

**新しいターミナルウィンドウを開いて**以下を実行：

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
   GET:/v1/admin/students
   ...
```

### ステップ5: 動作確認

1. バックエンドサーバーが起動していることを確認
2. ブラウザで `http://localhost:3000/login` にアクセス
3. ログインを試みる

## トラブルシューティング

### エラー: `Cannot find module 'ts-node'`

**解決方法**:
```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm install --save-dev ts-node @types/node
```

### エラー: `Port 3001 is already in use`

**解決方法**:
```bash
# ポート3001を使用しているプロセスを確認
lsof -ti:3001

# プロセスを終了
lsof -ti:3001 | xargs kill -9

# 再度起動
npm run dev
```

### エラー: `Handler not found`

**原因**: Lambda関数がビルドされていない

**解決方法**:
```bash
# 必要なLambda関数をビルド
cd /Users/masahiro/MySelector/apps/qr-attendance/backend/functions/users/login
npm install
npm run build

# 他のLambda関数も必要に応じてビルド
cd ../register
npm install
npm run build
```

### エラー: データベース接続エラー

**解決方法**:
1. MySQLが起動しているか確認：
   ```bash
   mysql.server status
   ```

2. `.env`ファイルの設定を確認
3. データベースが作成されているか確認：
   ```bash
   mysql -u root -p -e "SHOW DATABASES LIKE 'qr_attendance';"
   ```

## 開発時の推奨ワークフロー

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

### ターミナル3: その他の作業

データベース操作やその他のコマンド用

## 自動リロード（オプション）

変更を自動的に反映させるには：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev:watch
```

これにより、`local-server.ts`の変更が自動的に反映されます。

## 次のステップ

バックエンドサーバーが起動したら：

1. ブラウザで `http://localhost:3000/login` にアクセス
2. ログインを試みる
3. 管理者機能（生徒管理・スタッフ管理）をテスト
