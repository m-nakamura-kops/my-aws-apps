# Polaris環境構築 チェックリスト

GitHubログインができない場合でも、環境構築の準備を進めることができます。

## ✅ 準備完了した項目

- [x] SSH鍵の生成
- [x] Dockerの確認（インストール済み）
- [x] Node.jsの確認（インストール済み）
- [x] npmの確認（インストール済み）
- [x] Gitの確認（インストール済み）
- [x] docker-compose.ymlテンプレートの作成
- [x] .envファイルテンプレートの作成
- [x] 環境構築ガイドの作成

## ⏳ GitHubログイン後に実行する項目

### ステップ1: GitHubにSSH鍵を追加

1. [ ] GitHubにログイン（`developer.kops1124`）
2. [ ] Settings → SSH and GPG keys → New SSH key
3. [ ] 公開鍵を追加:
   ```
   ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJDOHcoA72tcnQdopq4BP4ZurR1ziNEaeH+nA+C5lZNA developer@ko-partners.biz
   ```
4. [ ] 「Configure SSO」→「Authorize」でJPDigitalCoLtd組織へのアクセスを承認

### ステップ2: リポジトリのクローン

```bash
cd ~
git clone git@github.com:JPDigitalCoLtd/jp-polaris-app.git
cd jp-polaris-app
```

### ステップ3: ファイルの確認とコピー

1. [ ] `docker-compose.yml` の内容を確認
   - リポジトリ内の `docker-compose.yml` と `~/MySelector/docker-compose.yml.template` を比較
   - 必要に応じて更新

2. [ ] `.env` ファイルの作成
   ```bash
   # リポジトリ内で実行
   cp ~/MySelector/env.template .env
   # または、リポジトリ内に .env.example がある場合は
   cp .env.example .env
   ```
   - 必要に応じて値を編集

### ステップ4: Docker環境のセットアップ

```bash
# リポジトリ内で実行
docker-compose up -d
```

確認:
- [ ] MySQLコンテナが起動（ポート3310）
- [ ] MongoDBコンテナが起動（ポート27018）
- [ ] MailHogコンテナが起動（ポート8026, 1026）

```bash
docker-compose ps
```

### ステップ5: 依存関係のインストール

```bash
# リポジトリ内で実行
npm install
```

### ステップ6: アプリケーションの起動

```bash
# リポジトリ内で実行
npm run dev
```

確認:
- [ ] アプリケーションが `http://localhost:5001` で起動
- [ ] ブラウザでアクセスして動作確認

## 🌐 VPN設定（検証環境アクセス用）

検証環境にアクセスする場合のみ必要:
- [ ] Surfshark VPNアプリをダウンロード・インストール
- [ ] 手動接続の設定:
  - プロトコル: OpenVPN (TCP)
  - サービスユーザー名: `rzxeCCw9qJVAh2jAXVa6hMCc`
  - サービスパスワード: `f9puGx72Wj8tdYWdQpF6ALbx`
  - ホスト名/IP: `86.104.213.225`
  - ポート: `1443`
- [ ] VPN接続後、検証環境URLにアクセス: https://jpai-polaris-dev.azurewebsites.net/miniapps

## 📝 環境の使い分け

- **実装環境**: `localhost:5001`（新環境、全てNext.js）
- **検証環境**: `https://jpai-polaris-dev.azurewebsites.net/miniapps`（VPN設定必要）
- **旧環境**: `localhost:3000` + `localhost:8000`（互換性確認が必要な場合のみ）

## 🔍 トラブルシューティング

### Dockerコンテナが起動しない

```bash
# ログを確認
docker-compose logs

# 再起動
docker-compose restart

# 完全にクリーンアップして再起動
docker-compose down
docker-compose up -d
```

### ポートが既に使用されている

```bash
# ポートの使用状況を確認
lsof -i :3310  # MySQL
lsof -i :27018 # MongoDB
lsof -i :5001  # Next.js
lsof -i :1026  # MailHog

# 使用しているプロセスを終了
kill -9 <PID>
```

### データベース接続エラー

1. Dockerコンテナが起動しているか確認
2. `.env`ファイルの`DATABASE_URL`が正しいか確認（ポート3310）
3. MySQLコンテナのヘルスチェックを確認

## 📚 参考資料

- **環境構築ガイド**: `POLARIS_SETUP_GUIDE.md`
- **GitHubログイン トラブルシューティング**: `GITHUB_LOGIN_TROUBLESHOOTING.md`
- **セットアップ状況**: `SETUP_STATUS.md`
- **リポジトリ**: https://github.com/JPDigitalCoLtd/jp-polaris-app

