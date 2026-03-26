# クイックスタートガイド

## 今日から開発を始めるための最短手順

このガイドでは、QRコード打刻システムの開発を今日から始められるように、最小限の手順を説明します。

## 前提条件チェック

以下のコマンドで必要なツールがインストールされているか確認してください：

```bash
# Node.jsのバージョン確認（18.x以上が必要）
node --version

# npmのバージョン確認
npm --version

# Gitのバージョン確認
git --version

# MySQLのバージョン確認（オプション、後で設定でも可）
mysql --version
```

## ステップ1: GitHubへのプッシュ（5分）

### 1-1. リモートリポジトリの確認

```bash
cd /Users/masahiro/MySelector
git remote -v
```

`origin`が表示されればOKです。表示されない場合は、[GITHUB_PUSH_GUIDE.md](./GITHUB_PUSH_GUIDE.md)を参照してください。

### 1-2. ファイルをコミット・プッシュ

```bash
# QRコード打刻システムのファイルを追加
git add apps/qr-attendance/
git add README.md

# コミット
git commit -m "feat: QRコード打刻システムの初期構造を追加"

# プッシュ
git push origin main
```

## ステップ2: 自動セットアップスクリプトの実行（5分）

```bash
cd apps/qr-attendance
./scripts/setup.sh
```

このスクリプトが以下を自動実行します：
- ✅ フロントエンドの依存関係インストール
- ✅ バックエンドの依存関係インストール
- ✅ 環境変数ファイル（.env.example）のコピー

## ステップ3: 環境変数の設定（5分）

### 3-1. バックエンドの環境変数

```bash
cd apps/qr-attendance/backend
# .envファイルを編集
# 最低限、データベース接続情報を設定してください
```

`.env`ファイルの最小設定例：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=qr_attendance
DB_SSL=false
```

### 3-2. フロントエンドの環境変数

```bash
cd apps/qr-attendance/frontend
# .env.localファイルを編集
```

`.env.local`ファイルの最小設定例：

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**注意**: Cognito設定は後で設定できます。今は空欄のままでOKです。

## ステップ4: データベースのセットアップ（10分）

### 4-1. データベース作成

```bash
mysql -u root -p
```

MySQLに接続後：

```sql
CREATE DATABASE qr_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### 4-2. スキーマ適用

```bash
cd apps/qr-attendance/database
mysql -u root -p qr_attendance < schema.sql
```

## ステップ5: 動作確認（5分）

### 5-1. フロントエンドの起動

```bash
cd apps/qr-attendance/frontend
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスして、ページが表示されることを確認してください。

### 5-2. バックエンドのビルド確認

```bash
cd apps/qr-attendance/backend
npm run build
```

エラーがなければOKです。

## 完了！

これで開発を始める準備が整いました！

## 次のステップ

1. **フェーズ2: 認証機能の実装**に進む
   - [ロードマップ](./ROADMAP.md)のフェーズ2を参照

2. **開発を続ける**
   - フロントエンド: `cd frontend && npm run dev`
   - バックエンド: 必要に応じてLambda関数を実装

## トラブルシューティング

### npm installでエラーが出る場合

```bash
# キャッシュをクリア
npm cache clean --force

# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
```

### データベース接続エラー

- MySQLが起動しているか確認: `mysql.server status`
- パスワードが正しいか確認
- `.env`ファイルの設定を確認

### ポートが既に使用されている場合

```bash
# ポート3000が使用中の場合
lsof -ti:3000 | xargs kill -9

# ポート3001が使用中の場合
lsof -ti:3001 | xargs kill -9
```

## 参考ドキュメント

- [セットアップガイド（詳細）](./SETUP.md)
- [GitHubプッシュガイド](./GITHUB_PUSH_GUIDE.md)
- [実装ロードマップ](./ROADMAP.md)
- [API仕様書](./API.md)
