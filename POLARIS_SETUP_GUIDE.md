# Polaris 環境構築ガイド

このガイドでは、Polarisプロジェクトのローカル環境構築手順を説明します。

## 🎯 クイックスタート

自動セットアップスクリプトを使用する場合：

```bash
cd ~/MySelector
./setup_polaris.sh
```

手動で進める場合は、以下の手順に従ってください。

## 📋 前提条件

- macOS（このガイドはmacOS向けです）
- Gitがインストールされていること
- Docker Desktopがインストールされていること
- Node.jsがインストールされていること（推奨バージョン: 18.x以上）
- GitHubアカウント（`developer@ko-partners.biz`）へのアクセス権限
- VPN設定（検証環境アクセス用）

## 🔐 1. GitHub SSH認証の設定

JPDigitalCoLtd組織のリポジトリにアクセスするため、SSH認証が必要です。

### 1.1 SSH鍵の生成（まだ持っていない場合）

```bash
ssh-keygen -t ed25519 -C "developer@ko-partners.biz"
```

**注意**: 既にSSH鍵が生成されている場合は、このステップをスキップしてください。

### 1.2 SSH鍵をGitHubに追加

1. 公開鍵をコピー：
```bash
cat ~/.ssh/id_ed25519.pub
```

**現在の公開鍵**:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJDOHcoA72tcnQdopq4BP4ZurR1ziNEaeH+nA+C5lZNA developer@ko-partners.biz
```

2. GitHubにログイン（`developer@ko-partners.biz` / `developer.kops1124`）
3. Settings → SSH and GPG keys → New SSH key
4. 上記の公開鍵を貼り付けて保存

### 1.3 SSO認証の承認

1. GitHubのSSH keys設定ページで、追加したSSH鍵の「Configure SSO」をクリック
2. 「Authorize」ボタンをクリックしてJPDigitalCoLtd組織へのアクセスを承認

参考: https://github.com/h-magome/kops-knowledges/blob/main/docs/%E7%92%B0%E5%A2%83%E6%A7%8B%E7%AF%89/GitHub-SSH%E8%A8%AD%E5%AE%9A%E3%82%AC%E3%82%A4%E3%83%89.md

## 📦 2. リポジトリのクローン

```bash
cd ~/  # または任意のディレクトリ
git clone git@github.com:JPDigitalCoLtd/jp-polaris-app.git
cd jp-polaris-app
```

**注意**: HTTPSではなくSSHを使用してください。SSO認証が必要な場合、ブラウザが開いて認証を求められることがあります。

## 🐳 3. Docker環境のセットアップ

### 3.1 docker-compose.ymlの確認

プロジェクトルートに`docker-compose.yml`があることを確認してください。内容は以下の通りです：

```yaml
services:
    db:
        image: mysql:8.0
        environment:
            MYSQL_ROOT_HOST: '%'
            MYSQL_ROOT_PASSWORD: 'root'
            MYSQL_DATABASE: 'polaris'
            TZ: 'UTC'
        ports:
            - '3310:3306'
        volumes:
            - data-volume:/var/lib/mysql
        command: '--general_log=0 --slow_query_log=0 --max_connections=500 --default-authentication-plugin=mysql_native_password'
        cap_add:
            - SYS_NICE
        healthcheck:
            test: ['CMD-SHELL', "mysql -h 127.0.0.1 -u root -p'root' -P 3306 || exit 1"]
            interval: 3s
            timeout: 30s
            retries: 10
    mongodb:
        image: mongo
        environment:
            MONGO_INITDB_DATABASE: polaris
        volumes:
            - mongodb-volume:/data/db
        ports:
            - '27018:27017'
    mailhog:
        image: mailhog/mailhog
        platform: linux/amd64
        ports:
            - '8026:8025'
            - '1026:1025'
volumes:
    data-volume:
    mongodb-volume:
```

### 3.2 Dockerコンテナの起動

```bash
docker-compose up -d
```

### 3.3 コンテナの状態確認

```bash
docker-compose ps
```

以下の3つのコンテナが起動していることを確認：
- `db` (MySQL) - ポート3310
- `mongodb` - ポート27018
- `mailhog` - ポート8026, 1026

## ⚙️ 4. 環境変数の設定

### 4.1 .envファイルの作成

プロジェクトルートに`.env`ファイルを作成し、以下の内容を設定してください：

```env
# ナレッジストレージ設定
# ====================
# KNOWLEDGE_STORAGE_MODE: ナレッジファイルの保存先を指定
# - 'local': ChromaDBを使用したローカルストレージ
# - 'azure' または未設定: Azure AI Searchを使用（デフォルト）
KNOWLEDGE_STORAGE_MODE=local
# KNOWLEDGE_LOCAL_PATH: ローカルストレージの保存先パス
# KNOWLEDGE_STORAGE_MODE=localの場合のみ使用
# デフォルト: .knowledge_storage
KNOWLEDGE_LOCAL_PATH=.knowledge_storage
# ChromaDBサーバー設定（ローカルストレージモード用）
# デフォルト: localhost:10000
CHROMA_HOST=localhost
CHROMA_PORT=10000
# NextAuth 設定
NEXTAUTH_SECRET=abc123
# データベース設定
DATABASE_URL=mysql://root:root@localhost:3310/polaris?connection_limit=10&pool_timeout=20
# Admin Secret Key for admin authentication
ADMIN_SECRET_KEY=your-admin-secret-key-here
# 以下 apiから
DEBUG="True"
# Django Secret Key
SECRET_KEY="django-insecure-w5ba5%_\$sr2dxqwq_i)&+b_)tmf&j!&vwpi9ae1xv=-@ix^$7^"
# Django Allowed Host (e.g. localhost,xxx.xxx.xxx.xxx)
ALLOW_HOST="localhost"
# Django CSRF Trusted Origin
CSRF_TRUSTED_ORIGIN="http://localhost:8000"
# CORS Origin Whitelist
CORS_ORIGIN_WHITELIST="http://localhost:8000"
# SMTP Server
EMAIL_HOST="localhost"
EMAIL_PORT="1026"
EMAIL_USE_TLS="False"
# Email Info
EMAIL_INFO_USER="info@example.com"
EMAIL_INFO_USER_PASSWORD=
# Email Alert
EMAIL_ALERT_USER="error@example.com"
EMAIL_ALERT_USER_PASSWORD=
# FRONTEND URL
FRONTEND_URL="http://localhost:3000"
# MongoDB Database
MONGO_CONNECTION_STRING="mongodb://localhost:27018/"
MONGODB_URI="mongodb://localhost:27018/polaris"
MONGO_DB_NAME="polaris"
# Superuser
SUPERUSER_EMAIL="admin@example.com"
SUPERUSER_PASSWORD="123456789Aa#"
TENANT_NAME="Default Tenant"
DEPARTMENT_NAME="Default Department"
# Azure Application Insights
APPLICATIONINSIGHTS_CONNECTION_STRING="xxx"
# Azure OpenAI API
AZURE_OPENAI_API_BASE="https://jp-degital-polaris.openai.azure.com/"
AZURE_OPENAI_API_KEY="<your-azure-openai-api-key>"
AZURE_EMBEDDINGS_MODEL_NAME="text-embedding-3-large"
AZURE_EMBEDDINGS_API_VERSION="2025-01-01-preview"
AZURE_BLOB_STORAGE_ACCOUNT_NAME="https://jpdegital.blob.core.windows.net"
AZURE_BLOB_STORAGE_ACCOUNT_KEY="<your-azure-storage-account-key>"
AZURE_BLOB_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=jpdegital;AccountKey=<your-azure-storage-account-key>;EndpointSuffix=core.windows.net"
AZURE_BLOB_STORAGE_CONTAINER_NAME="local-azuma"
AZURE_BLOB_STORAGE_BASE_DIR="develop"
AZURE_BLOB_STORAGE_SAS_EXPIRY_HOURS = 8760 # 1year
# Azure Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="https://di-jp-degital-polaris.cognitiveservices.azure.com/"
AZURE_DOCUMENT_INTELLIGENCE_KEY="<your-azure-document-intelligence-key>"
AZURE_DOCUMENT_INTELLIGENCE_READ_MODEL_API_VERSION="2024-07-31-preview"
# Azure AI Search
AZURE_AI_SEARCH_API_KEY="<your-azure-search-admin-key>"
AZURE_AI_SEARCH_BASE_URL="https://dr-chatbot-dev-search.search.windows.net/"
AZURE_AI_SEARCH_SERVICE_NAME="dr-chatbot-dev-search"
AZURE_AI_SEARCH_API_VERSION="2024-07-01"
# Chat File Settings
MAX_CHAT_FILE_COUNT=1 # ファイル個数
MAX_CHAT_FILE_SIZE_PDF=3 # 1MB単位
MAX_CHAT_FILE_SIZE_CSV=10 # 1MB単位
MAX_CHAT_DEFAULT_FILE_SIZE=1 # 1MB単位
# 以下webから
TZ=UTC
POLARIS_API_URL=http://localhost:8000/api/v1
# Project Name
PROJECT_NAME="Polaris"
# Contact Urls (通常は空で設定, Asana等使用する場合のみ値を設定)
CONTACT_LINK=
TENANT_CONTACT_LINK=
SIDEBAR_HISTORIES_PAGE_LIMIT=20
# ファイルサイズ上限（MB単位）
NEXT_PUBLIC_MAX_FILE_SIZE_MB_CSV=2
NEXT_PUBLIC_MAX_FILE_SIZE_MB_PDF=2
# その他のファイル（CSV、PDFなど）の上限枚数
MAX_OTHER_FILES_COUNT=2
NEXT_PUBLIC_MAX_OTHER_FILES_COUNT=2
# テナント管理画面 チャット履歴・操作ログ CSVダウンロード期間の選択肢
NEXT_PUBLIC_CSV_EXPORT_PRESET_PERIODS="1:1日,7:7日,3:3日,14:14日,30:30日"
```

**重要**: `.env`ファイルには機密情報が含まれているため、Gitにコミットしないでください。

## 📚 5. 依存関係のインストール

プロジェクトルートで以下を実行：

```bash
npm install
# または
yarn install
```

## 🚀 6. アプリケーションの起動

### 6.1 開発サーバーの起動

```bash
npm run dev
# または
yarn dev
```

アプリケーションは `http://localhost:5001` で起動します。

### 6.2 動作確認

ブラウザで `http://localhost:5001` にアクセスして、アプリケーションが正常に動作していることを確認してください。

## 🌐 7. VPN設定（検証環境アクセス用）

検証環境（`https://jpai-polaris-dev.azurewebsites.net/miniapps`）にアクセスするには、VPN設定が必要です。

### 7.1 Surfshark VPNの設定

1. Surfshark VPNアプリをダウンロード・インストール
   - macOS版をダウンロードしてください
   - 参考動画: https://support.surfshark.com/hc/en-us/articles/360003204233-How-to-set-up-the-OpenVPN-Connect-app-on-Windows

2. 手動接続の設定：
   - プロトコル: OpenVPN (TCP)
   - サービスユーザー名: `rzxeCCw9qJVAh2jAXVa6hMCc`
   - サービスパスワード: `f9puGx72Wj8tdYWdQpF6ALbx`
   - ホスト名/IP: `86.104.213.225`
   - ポート: `1443`

3. VPN接続後、検証環境URLにアクセス可能になります

## 📝 8. 環境の使い分け

- **実装環境**: `localhost:5001`（新環境、全てNext.js）
- **検証環境**: `https://jpai-polaris-dev.azurewebsites.net/miniapps`（VPN設定必要）
- **旧環境**: `localhost:3000` + `localhost:8000`（互換性確認が必要な場合のみ）

## 🔧 トラブルシューティング

### Dockerコンテナが起動しない

```bash
# コンテナのログを確認
docker-compose logs

# コンテナを再起動
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

### GitHubのSSO認証エラー

1. GitHubのSSH keys設定ページでSSO認証を再承認
2. `git fetch`を実行してブラウザで認証を完了

### データベース接続エラー

1. Dockerコンテナが起動しているか確認
2. `.env`ファイルの`DATABASE_URL`が正しいか確認（ポート3310）
3. MySQLコンテナのヘルスチェックを確認

## 📚 参考資料

- リポジトリ: https://github.com/JPDigitalCoLtd/jp-polaris-app
- 環境構築ガイド（参考）: https://github.com/h-magome/kops-knowledges/blob/main/docs/Digital-Recipe_%E9%83%B8%E5%86%85%E7%92%B0%E5%A2%83%E6%A7%8B%E7%AF%89%E3%82%AC%E3%82%A4%E3%83%89.md
- GitHub SSH設定ガイド: https://github.com/h-magome/kops-knowledges/blob/main/docs/%E7%92%B0%E5%A2%83%E6%A7%8B%E7%AF%89/GitHub-SSH%E8%A8%AD%E5%AE%9A%E3%82%AC%E3%82%A4%E3%83%89.md

## ⚠️ 注意事項

- `.env`ファイルには機密情報が含まれているため、Gitにコミットしないでください
- VPN認証情報は共有情報ですが、外部に漏洩しないよう注意してください
- Azure APIキーなどの認証情報は適切に管理してください

