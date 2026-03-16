# ログインエラーの即座の解決方法

## 問題

「ネットワークエラー: サーバーに接続できません」と表示される

**原因**: バックエンドAPIサーバー（`http://localhost:3001`）が起動していない

## 解決方法（3ステップ）

### ステップ1: 必要なパッケージをインストール

**新しいターミナルウィンドウを開いて**以下を実行：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm install --save-dev ts-node nodemon
```

### ステップ2: ログインLambda関数をビルド

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend/functions/users/login
npm install
npm run build
```

### ステップ3: バックエンドサーバーを起動

**同じターミナルで**（または新しいターミナルで）：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev
```

以下のメッセージが表示されれば成功です：

```
🚀 Local API Server running on http://localhost:3001
📝 Available endpoints:
   POST:/v1/users/login
   ...
```

### ステップ4: ブラウザでログインを再試行

1. ブラウザで `http://localhost:3000/login` をリロード
2. メールアドレスとパスワードを入力
3. 「ログイン」ボタンをクリック

## ワンライナー（一括実行）

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend && \
npm install --save-dev ts-node nodemon && \
cd functions/users/login && npm install && npm run build && \
cd ../../.. && npm run dev
```

## または、起動スクリプトを使用

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance
./START_BACKEND.sh
```

## 重要なポイント

⚠️ **バックエンドサーバーは別のターミナルで起動する必要があります**

- **ターミナル1**: フロントエンド（`npm run dev`）
- **ターミナル2**: バックエンド（`npm run dev`）

両方のサーバーが起動している状態で、ブラウザからアクセスしてください。

## 動作確認

バックエンドサーバーが起動しているか確認：

```bash
# 別のターミナルで
curl http://localhost:3001/v1/users/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

エラーメッセージが返ってくる場合は正常です（認証エラーは想定通り）。
`ERR_CONNECTION_REFUSED`が返ってくる場合は、サーバーが起動していません。

## トラブルシューティング

### エラー: `Cannot find module 'ts-node'`

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm install --save-dev ts-node nodemon
```

### エラー: `Handler not found`

ログインLambda関数をビルドしてください：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend/functions/users/login
npm install
npm run build
```

### エラー: `.env`ファイルが見つからない

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
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
