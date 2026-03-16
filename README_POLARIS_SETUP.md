# Polaris環境構築 - 準備完了

GitHubログインができない状態でも、環境構築の準備を完了しました。

## 📁 作成したファイル一覧

### ドキュメント
1. **`POLARIS_SETUP_GUIDE.md`** - 詳細な環境構築ガイド
2. **`SETUP_STATUS.md`** - 現在の状況と次のステップ
3. **`ENVIRONMENT_SETUP_CHECKLIST.md`** - 環境構築チェックリスト
4. **`GITHUB_LOGIN_TROUBLESHOOTING.md`** - GitHubログイン トラブルシューティングガイド
5. **`VPN_SETUP_GUIDE.md`** - VPN設定ガイド（検証環境アクセス用）

### テンプレートファイル
1. **`docker-compose.yml.template`** - Docker Compose設定ファイルのテンプレート
2. **`env.template`** - 環境変数ファイルのテンプレート

### スクリプト
1. **`setup_polaris.sh`** - 自動セットアップスクリプト（GitHubログイン後に使用）

## ✅ 完了した準備作業

- [x] SSH鍵の生成
- [x] 必要なツールの確認（Docker, Node.js, npm, Git）
- [x] docker-compose.ymlテンプレートの作成
- [x] .envファイルテンプレートの作成
- [x] 環境構築ガイドの作成
- [x] VPN設定ガイドの作成

## ⏳ GitHubログイン後に実行する手順

### 1. GitHubにSSH鍵を追加

公開鍵:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJDOHcoA72tcnQdopq4BP4ZurR1ziNEaeH+nA+C5lZNA developer@ko-partners.biz
```

手順:
1. GitHubにログイン（`developer.kops1124`）
2. Settings → SSH and GPG keys → New SSH key
3. 上記の公開鍵を追加
4. 「Configure SSO」→「Authorize」でJPDigitalCoLtd組織へのアクセスを承認

### 2. リポジトリのクローン

```bash
cd ~
git clone git@github.com:JPDigitalCoLtd/jp-polaris-app.git
cd jp-polaris-app
```

### 3. ファイルのコピーと設定

```bash
# docker-compose.ymlの確認（リポジトリ内のものと比較）
# 必要に応じて更新

# .envファイルの作成
cp ~/MySelector/env.template .env
# 必要に応じて値を編集
```

### 4. Docker環境の起動

```bash
docker-compose up -d
docker-compose ps  # 確認
```

### 5. 依存関係のインストール

```bash
npm install
```

### 6. アプリケーションの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5001` にアクセス

## 📚 参考資料

- **環境構築ガイド**: `POLARIS_SETUP_GUIDE.md`
- **チェックリスト**: `ENVIRONMENT_SETUP_CHECKLIST.md`
- **GitHubログイン トラブルシューティング**: `GITHUB_LOGIN_TROUBLESHOOTING.md`
- **VPN設定ガイド**: `VPN_SETUP_GUIDE.md`
- **セットアップ状況**: `SETUP_STATUS.md`

## 🔑 重要な情報

### アカウント情報
- **GitHub**: `developer@ko-partners.biz` / `developer.kops1124`
- **Google**: `h-magome@dxr.co.jp`

### 環境URL
- **実装環境**: `localhost:5001`（新環境、全てNext.js）
- **検証環境**: `https://jpai-polaris-dev.azurewebsites.net/miniapps`（VPN設定必要）
- **旧環境**: `localhost:3000` + `localhost:8000`（互換性確認が必要な場合のみ）

### VPN認証情報（検証環境用）
- **プロトコル**: OpenVPN (TCP)
- **ユーザー名**: `rzxeCCw9qJVAh2jAXVa6hMCc`
- **パスワード**: `f9puGx72Wj8tdYWdQpF6ALbx`
- **ホスト名/IP**: `86.104.213.225`
- **ポート**: `1443`

## 🚀 クイックスタート（GitHubログイン後）

```bash
# セットアップスクリプトを実行
cd ~/MySelector
./setup_polaris.sh
```

または、手動で:

```bash
cd ~
git clone git@github.com:JPDigitalCoLtd/jp-polaris-app.git
cd jp-polaris-app
cp ~/MySelector/env.template .env
docker-compose up -d
npm install
npm run dev
```

