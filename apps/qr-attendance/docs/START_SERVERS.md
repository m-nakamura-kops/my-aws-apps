# サーバー起動ガイド

## 問題

`ERR_CONNECTION_REFUSED` エラーが発生しています。

**原因**: フロントエンドサーバー（`localhost:3000`）が起動していません。

## 解決方法

### 2つのターミナルが必要です

このアプリケーションは、フロントエンドとバックエンドの2つのサーバーが必要です。

#### ターミナル1: フロントエンドサーバー

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
npm run dev
```

または、起動スクリプトを使用：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance
./START_FRONTEND.sh
```

正常に起動すると、以下のようなメッセージが表示されます：

```
  ▲ Next.js 14.2.0
  - Local:        http://localhost:3000
  - Ready in 2.3s
```

#### ターミナル2: バックエンドサーバー

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev
```

または、起動スクリプトを使用：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance
./START_BACKEND.sh
```

正常に起動すると、以下のようなメッセージが表示されます：

```
🚀 Local API Server running on http://localhost:3001
📝 Available endpoints:
   POST:/v1/users/login
   ...
```

## 完全な起動手順

### ステップ1: フロントエンドサーバーを起動（ターミナル1）

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
npm run dev
```

### ステップ2: バックエンドサーバーを起動（ターミナル2）

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev
```

### ステップ3: ブラウザでアクセス

1. ブラウザで `http://localhost:3000` にアクセス
2. ログイン画面が表示されることを確認

## 確認事項

### フロントエンドサーバーが起動しているか確認

```bash
# ポート3000が使用されているか確認
lsof -ti:3000
```

プロセスIDが表示されれば、フロントエンドサーバーが起動しています。

### バックエンドサーバーが起動しているか確認

```bash
# ポート3001が使用されているか確認
lsof -ti:3001
```

プロセスIDが表示されれば、バックエンドサーバーが起動しています。

### 両方のサーバーが起動しているか確認

```bash
curl http://localhost:3000
curl http://localhost:3001/v1/users/login -X POST -H "Content-Type: application/json" -d '{"email":"test","password":"test"}'
```

## トラブルシューティング

### エラー: `Port 3000 is already in use`

```bash
# ポート3000を使用しているプロセスを終了
lsof -ti:3000 | xargs kill -9

# 再度起動
cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
npm run dev
```

### エラー: `Port 3001 is already in use`

```bash
# ポート3001を使用しているプロセスを終了
lsof -ti:3001 | xargs kill -9

# 再度起動
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev
```

### エラー: `npm run dev` が見つからない

```bash
# 依存関係をインストール
cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
npm install

# 再度起動
npm run dev
```

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

### ターミナル3: その他の作業
データベース操作やその他のコマンド用

## 次のステップ

両方のサーバーが起動したら：

1. ブラウザで `http://localhost:3000` にアクセス
2. ログイン画面が表示されることを確認
3. ユーザー登録またはログインを試す
