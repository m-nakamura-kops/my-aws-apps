# セットアップガイド

## 前提条件

- Node.js 18.x以上
- npm または yarn
- AWS CLI設定済み（本番環境用）
- MySQL/MariaDB（ローカル開発用）

## ローカル開発環境のセットアップ

### クイックスタート（推奨）

セットアップスクリプトを使用すると、自動的に環境を構築できます：

```bash
cd apps/qr-attendance
./scripts/setup.sh
```

スクリプトが以下を自動実行します：
- フロントエンド・バックエンドの依存関係インストール
- 環境変数ファイル（.env.example）のコピー
- セットアップ状況の確認

### 手動セットアップ

#### 1. データベースのセットアップ

```bash
# データベース作成
mysql -u root -p
CREATE DATABASE qr_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# スキーマ適用
cd apps/qr-attendance/database
mysql -u root -p qr_attendance < schema.sql
```

### 2. 環境変数の設定

#### バックエンド

`.env.example`をコピーして`.env`を作成：

```bash
cd apps/qr-attendance/backend
cp .env.example .env
```

`.env`ファイルを編集して、実際の値を設定してください：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=qr_attendance
DB_SSL=false

# Cognito設定は後で設定（ローカル開発時は空欄でも可）
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
AWS_REGION=ap-northeast-1
```

#### フロントエンド

`.env.example`をコピーして`.env.local`を作成：

```bash
cd apps/qr-attendance/frontend
cp .env.example .env.local
```

`.env.local`ファイルを編集して、実際の値を設定してください：

```env
NEXT_PUBLIC_API_URL=http://localhost:3001

# Cognito設定は後で設定（ローカル開発時は空欄でも可）
NEXT_PUBLIC_COGNITO_USER_POOL_ID=
NEXT_PUBLIC_COGNITO_CLIENT_ID=
NEXT_PUBLIC_AWS_REGION=ap-northeast-1
```

### 3. フロントエンドのセットアップ

```bash
cd apps/qr-attendance/frontend
npm install
npm run dev
```

フロントエンドは `http://localhost:3000` で起動します。

### 4. バックエンドのセットアップ

```bash
cd apps/qr-attendance/backend
npm install
npm run build
```

#### Serverless Frameworkを使用する場合

```bash
# Serverless Frameworkインストール（グローバル）
npm install -g serverless

# ローカル実行
serverless offline start
```

バックエンドは `http://localhost:3001` で起動します。

## AWS環境のセットアップ

### 1. AWS CDKのセットアップ

```bash
cd apps/qr-attendance/infrastructure/cdk
npm install

# CDKブートストラップ（初回のみ）
cdk bootstrap

# デプロイ
cdk deploy --context env=dev
```

### 2. Amplify Hostingのセットアップ

1. AWS Amplifyコンソールにアクセス
2. 「新しいアプリ」→「GitHubからデプロイ」を選択
3. リポジトリを選択
4. ビルド設定:
   - アプリルート: `apps/qr-attendance/frontend`
   - ビルドコマンド: `npm ci && npm run build`
   - 出力ディレクトリ: `.next`

### 3. Cognito User Poolの作成

```bash
# AWS CLIを使用
aws cognito-idp create-user-pool \
  --pool-name qr-attendance-users \
  --auto-verified-attributes email

# User Pool Client作成
aws cognito-idp create-user-pool-client \
  --user-pool-id <USER_POOL_ID> \
  --client-name qr-attendance-client \
  --generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH
```

### 4. RDSインスタンスの作成

```bash
# AWS CLIを使用（またはCDKで自動化）
aws rds create-db-instance \
  --db-instance-identifier qr-attendance-db \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --master-username admin \
  --master-user-password <PASSWORD> \
  --allocated-storage 20 \
  --vpc-security-group-ids <SECURITY_GROUP_ID> \
  --db-subnet-group-name <SUBNET_GROUP_NAME>
```

## 開発フロー

### 1. 機能開発

```bash
# 新しいブランチ作成
git checkout -b feature/qr-attendance-login

# 開発
# ...

# コミット
git add .
git commit -m "feat: ログイン機能実装"

# プッシュ
git push origin feature/qr-attendance-login
```

### 2. テスト実行

```bash
# フロントエンド
cd frontend
npm run test

# バックエンド
cd backend
npm run test
```

### 3. デプロイ

#### 開発環境

```bash
# フロントエンド（Amplify自動デプロイ）
git push origin main

# バックエンド
cd backend
serverless deploy --stage dev
```

#### 本番環境

```bash
# 本番ブランチにマージ後、Amplifyが自動デプロイ
# バックエンド
cd backend
serverless deploy --stage prod
```

## トラブルシューティング

### データベース接続エラー

- 接続情報を確認
- セキュリティグループ設定を確認
- VPC設定を確認

### Cognito認証エラー

- User Pool IDとClient IDを確認
- リージョン設定を確認
- IAMロールの権限を確認

### Lambda実行エラー

- CloudWatch Logsを確認
- 環境変数を確認
- IAMロールの権限を確認

## 次のステップ

1. [ロードマップ](./ROADMAP.md)を確認
2. [API仕様書](./API.md)を参照
3. [アーキテクチャ詳細](./ARCHITECTURE.md)を確認
