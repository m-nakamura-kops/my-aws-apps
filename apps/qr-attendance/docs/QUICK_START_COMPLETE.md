# クイックスタート - 完全版

## 現在の状況

登録ページでネットワークエラーが発生しています。バックエンドサーバーが起動していない可能性があります。

## 完全な起動手順

### 前提条件

- Node.js 18.x以上がインストールされている
- MySQLがインストールされている（または後でインストール）

### ステップ1: データベースのセットアップ（初回のみ）

```bash
# MySQLをインストール（未インストールの場合）
brew install mysql
brew services start mysql

# データベース作成
mysql -u root -p
```

MySQLに接続後：

```sql
CREATE DATABASE qr_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

```bash
# スキーマ適用
cd /Users/masahiro/MySelector/apps/qr-attendance/database
mysql -u root -p qr_attendance < schema.sql
```

### ステップ2: 環境変数の設定

#### バックエンド

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
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
```

#### フロントエンド

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
cp .env.example .env.local
```

`.env.local`ファイルを編集：

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### ステップ3: 依存関係のインストール

#### バックエンド

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm install

# Lambda関数の依存関係もインストール
cd functions/users/login
npm install
npm run build

cd ../register
npm install
npm run build
```

#### フロントエンド

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
npm install
```

### ステップ4: サーバーの起動

**重要**: 2つのターミナルウィンドウが必要です。

#### ターミナル1: フロントエンド

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
npm run dev
```

正常に起動すると：
```
  ▲ Next.js 14.2.0
  - Local:        http://localhost:3000
```

#### ターミナル2: バックエンド

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev
```

正常に起動すると：
```
🚀 Local API Server running on http://localhost:3001
📝 Available endpoints:
   POST:/v1/users/login
   POST:/v1/users/register
   ...
```

### ステップ5: 動作確認

1. ブラウザで `http://localhost:3000` にアクセス
2. ログイン画面が表示されることを確認
3. 「新規登録はこちら」をクリック
4. 登録フォームが表示されることを確認

## トラブルシューティング

### エラー: `ERR_CONNECTION_REFUSED`

**原因**: バックエンドサーバーが起動していない

**解決方法**:
1. ターミナル2でバックエンドサーバーが起動しているか確認
2. 起動していない場合は、上記のステップ4を実行

### エラー: `Handler not found`

**原因**: Lambda関数がビルドされていない

**解決方法**:
```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend/functions/users/register
npm install
npm run build
```

### エラー: `InvalidParameterException: clientId`

**原因**: Cognito設定が空（ローカル開発では正常）

**解決方法**: 既に修正済みです。バックエンドサーバーを再起動してください。

### エラー: データベース接続エラー

**原因**: MySQLが起動していない、または`.env`の設定が間違っている

**解決方法**:
```bash
# MySQLの起動確認
brew services list | grep mysql

# MySQLを起動
brew services start mysql

# .envファイルの設定を確認
cat /Users/masahiro/MySelector/apps/qr-attendance/backend/.env
```

## ワンライナー起動スクリプト

### フロントエンド

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance && ./START_FRONTEND.sh
```

### バックエンド

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance && ./START_BACKEND.sh
```

## 確認コマンド

```bash
# 両方のサーバーが起動しているか確認
echo "フロントエンド: $(lsof -ti:3000 > /dev/null 2>&1 && echo '✅ 起動中' || echo '❌ 未起動')"
echo "バックエンド: $(lsof -ti:3001 > /dev/null 2>&1 && echo '✅ 起動中' || echo '❌ 未起動')"
```

## 次のステップ

両方のサーバーが起動したら：

1. ブラウザで `http://localhost:3000/register` にアクセス
2. フォームに入力してユーザー登録
3. 登録後、ログインを試す
