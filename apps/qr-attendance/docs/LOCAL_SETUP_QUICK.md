# ローカル環境セットアップ - クイックガイド

## 現在のディレクトリから実行する手順

### ステップ1: プロジェクトルートに移動

```bash
# プロジェクトルートに移動
cd /Users/masahiro/MySelector

# または、現在のディレクトリから相対パスで移動
cd ../../../../..
```

### ステップ2: フロントエンドのセットアップ

```bash
# フロントエンドディレクトリに移動
cd apps/qr-attendance/frontend

# 現在のディレクトリを確認
pwd
# 出力: /Users/masahiro/MySelector/apps/qr-attendance/frontend であることを確認

# 環境変数ファイルの作成
cp .env.example .env.local

# .env.localファイルを編集（エディタで開く）
# 最低限、以下を設定:
# NEXT_PUBLIC_API_URL=http://localhost:3001
```

### ステップ3: 依存関係のインストール

```bash
# 依存関係をインストール
npm install

# インストールが完了したら、package.jsonのスクリプトを確認
npm run
# 出力に "dev" が表示されることを確認
```

### ステップ4: フロントエンドの起動

```bash
# 開発サーバーを起動
npm run dev
```

正常に起動すると、以下のようなメッセージが表示されます：
```
  ▲ Next.js 14.2.0
  - Local:        http://localhost:3000
  - Ready in 2.3s
```

### ステップ5: ブラウザで確認

ブラウザで `http://localhost:3000` にアクセスして、ページが表示されることを確認してください。

## トラブルシューティング

### エラー: `cd: no such file or directory`

**原因**: 現在のディレクトリから相対パスで移動しようとしているが、パスが間違っている

**解決方法**:
```bash
# 絶対パスを使用
cd /Users/masahiro/MySelector/apps/qr-attendance/frontend

# または、プロジェクトルートから開始
cd /Users/masahiro/MySelector
cd apps/qr-attendance/frontend
```

### エラー: `cp: .env.example: No such file or directory`

**原因**: フロントエンドディレクトリにいない

**解決方法**:
```bash
# 現在のディレクトリを確認
pwd

# フロントエンドディレクトリに移動
cd /Users/masahiro/MySelector/apps/qr-attendance/frontend

# ファイルの存在確認
ls -la .env.example

# 存在することを確認してからコピー
cp .env.example .env.local
```

### エラー: `npm error Missing script: "dev"`

**原因**: 間違ったディレクトリでnpmコマンドを実行している、またはpackage.jsonが正しくない

**解決方法**:
```bash
# 現在のディレクトリを確認
pwd
# 出力が /Users/masahiro/MySelector/apps/qr-attendance/frontend であることを確認

# package.jsonの存在確認
ls -la package.json

# package.jsonの内容確認（devスクリプトがあるか）
cat package.json | grep -A 5 "scripts"

# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install

# 再度起動
npm run dev
```

### エラー: `zsh: command not found: #`

**原因**: コメント行（`#`で始まる行）をコマンドとして実行しようとしている

**解決方法**: 
- コメント行は実行しないでください
- コマンドのみをコピー&ペーストしてください

## 正しい実行例

```bash
# 1. プロジェクトルートに移動
cd /Users/masahiro/MySelector

# 2. フロントエンドディレクトリに移動
cd apps/qr-attendance/frontend

# 3. 環境変数ファイルをコピー
cp .env.example .env.local

# 4. 依存関係をインストール（初回のみ）
npm install

# 5. 開発サーバーを起動
npm run dev
```

## 次のステップ

フロントエンドが起動したら：

1. **バックエンドのセットアップ**（別のターミナルで）
   ```bash
   cd /Users/masahiro/MySelector/apps/qr-attendance/backend
   cp .env.example .env
   # .envファイルを編集してDB接続情報を設定
   ```

2. **データベースのセットアップ**
   ```bash
   mysql -u root -p
   CREATE DATABASE qr_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   EXIT;
   
   cd /Users/masahiro/MySelector/apps/qr-attendance/database
   mysql -u root -p qr_attendance < schema.sql
   ```

3. **動作確認**
   - ブラウザで `http://localhost:3000` にアクセス
   - ログイン画面が表示されることを確認
