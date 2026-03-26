# セットアップチェックリスト

## ✅ 完了した項目

- [x] プロジェクト構造の作成
- [x] データベーススキーマ（DDL）の作成
- [x] ドキュメント一式の作成
- [x] GitHubプッシュガイドの作成
- [x] 環境変数雛形ファイルの作成
- [x] セットアップスクリプトの作成

## 📋 次に実行する項目

### 1. GitHubへのプッシュ

```bash
cd /Users/masahiro/MySelector

# ファイルをステージング
git add apps/qr-attendance/
git add README.md

# コミット
git commit -m "feat: QRコード打刻システムの初期構造を追加"

# プッシュ
git push origin main
```

### 2. 環境変数の設定

#### バックエンド（必須）

`apps/qr-attendance/backend/.env` を編集：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=あなたのMySQLパスワード
DB_NAME=qr_attendance
DB_SSL=false
```

#### フロントエンド（必須）

`apps/qr-attendance/frontend/.env.local` を編集：

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. データベースのセットアップ

```bash
# MySQLに接続
mysql -u root -p

# データベース作成
CREATE DATABASE qr_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# スキーマ適用
cd apps/qr-attendance/database
mysql -u root -p qr_attendance < schema.sql
```

### 4. 依存関係のインストール確認

セットアップスクリプトが完了したら、以下を確認：

```bash
# フロントエンド
cd apps/qr-attendance/frontend
ls node_modules  # ディレクトリが存在することを確認

# バックエンド
cd apps/qr-attendance/backend
ls node_modules  # ディレクトリが存在することを確認
```

### 5. 動作確認

```bash
# フロントエンド起動
cd apps/qr-attendance/frontend
npm run dev

# ブラウザで http://localhost:3000 にアクセス
# 「QRコード打刻システム」のページが表示されればOK
```

## 🎯 完了後の確認事項

- [ ] GitHubにプッシュ完了
- [ ] 環境変数ファイル（.env, .env.local）を設定済み
- [ ] データベース作成・スキーマ適用完了
- [ ] 依存関係インストール完了
- [ ] フロントエンドが起動できることを確認

## 📚 参考ドキュメント

- [クイックスタートガイド](./docs/QUICK_START.md) - 最短手順
- [セットアップガイド（詳細）](./docs/SETUP.md) - 詳細な手順
- [GitHubプッシュガイド](./docs/GITHUB_PUSH_GUIDE.md) - GitHubへのプッシュ方法
- [実装ロードマップ](./docs/ROADMAP.md) - 今後の開発計画

## 🚀 次のステップ

セットアップが完了したら、**フェーズ2: 認証機能の実装**に進みましょう！
