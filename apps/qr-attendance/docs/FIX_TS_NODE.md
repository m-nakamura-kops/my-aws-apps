# ts-nodeコマンドが見つからないエラーの解決方法

## エラー

```
sh: ts-node: command not found
```

## 解決方法

### 方法1: npm installを実行（推奨）

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm install
```

これにより、`package.json`に記載されている`ts-node`と`nodemon`がインストールされます。

### 方法2: npxを使用（既に修正済み）

`package.json`のスクリプトを修正済みです。以下のコマンドで実行できます：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev
```

`npx`を使用することで、ローカルにインストールされた`ts-node`を自動的に見つけます。

### 方法3: 直接パスを指定

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
./node_modules/.bin/ts-node --project tsconfig.server.json local-server.ts
```

## 完全な手順

```bash
# 1. バックエンドディレクトリに移動
cd /Users/masahiro/MySelector/apps/qr-attendance/backend

# 2. 依存関係をインストール（ts-nodeを含む）
npm install

# 3. ログインLambda関数をビルド
cd functions/users/login
npm install
npm run build
cd ../../..

# 4. バックエンドサーバーを起動
npm run dev
```

## 確認

インストールが完了したか確認：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
ls node_modules/.bin/ts-node
```

ファイルが存在すれば、インストール成功です。
