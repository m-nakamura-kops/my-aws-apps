# GitHubプッシュガイド

## 概要

QRコード打刻システムのコードをGitHubリポジトリにプッシュする手順です。

## 前提条件

- Gitがインストールされていること
- GitHubアカウントを持っていること
- リポジトリへのアクセス権限があること

## 手順

### 1. 現在のGit状態確認

```bash
cd /Users/masahiro/MySelector
git status
```

### 2. リモートリポジトリの確認

既存のリモートリポジトリが設定されているか確認します：

```bash
git remote -v
```

**既にリモートが設定されている場合**:
- `origin`が表示されれば、そのまま使用できます
- 次のステップ3に進んでください

**リモートが設定されていない場合**:
以下のコマンドでリモートリポジトリを追加してください：

```bash
# GitHubリポジトリのURLを指定（例）
git remote add origin https://github.com/your-username/MySelector.git

# またはSSHを使用する場合
git remote add origin git@github.com:your-username/MySelector.git
```

### 3. QRコード打刻システムのファイルをステージング

```bash
# qr-attendanceディレクトリを追加
git add apps/qr-attendance/

# README.mdの変更も追加（プロジェクト一覧に追加されているため）
git add README.md

# 変更を確認
git status
```

### 4. コミット

```bash
git commit -m "feat: QRコード打刻システムの初期構造を追加

- データベーススキーマ（DDL）作成
- フロントエンド（Next.js）プロジェクト構造
- バックエンド（Lambda）プロジェクト構造
- Infrastructure as Code（CDK）構造
- ドキュメント一式（API仕様、アーキテクチャ、ロードマップ等）
- セットアップガイド"
```

### 5. GitHubにプッシュ

```bash
# メインブランチにプッシュ
git push origin main

# または、新しいブランチを作成してプッシュする場合
git checkout -b feature/qr-attendance-initial-setup
git push origin feature/qr-attendance-initial-setup
```

### 6. プッシュ確認

GitHubのリポジトリページで、以下のディレクトリが追加されていることを確認してください：

- `apps/qr-attendance/`
- `README.md`（更新されていること）

## トラブルシューティング

### エラー: "remote origin already exists"

既にリモートが設定されている場合：

```bash
# リモートURLを確認
git remote get-url origin

# URLを変更する必要がある場合
git remote set-url origin https://github.com/your-username/MySelector.git
```

### エラー: "failed to push some refs"

リモートに新しいコミットがある場合：

```bash
# リモートの変更を取得
git fetch origin

# マージまたはリベース
git pull origin main --rebase

# 再度プッシュ
git push origin main
```

### 認証エラー

GitHubの認証が必要な場合：

```bash
# Personal Access Tokenを使用する場合
# GitHub Settings > Developer settings > Personal access tokens でトークンを生成
# プッシュ時にユーザー名とトークンを入力

# または、SSH鍵を設定
# GitHub Settings > SSH and GPG keys でSSH鍵を登録
```

## 次のステップ

プッシュが完了したら、[SETUP.md](./SETUP.md)に従ってローカル開発環境をセットアップしてください。
