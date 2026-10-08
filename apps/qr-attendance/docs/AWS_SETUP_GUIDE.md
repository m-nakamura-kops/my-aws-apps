# AWS環境セットアップガイド

## 概要

ローカルにMySQLをインストールせず、AWS上のリソース（RDS、Cognito、Lambda等）を活用して開発を進めるためのガイドです。

## 前提条件

- AWSアカウントを持っていること
- AWS CLIがインストールされていること
- Node.js 18.x以上がインストールされていること

## ステップ1: AWS CLIの認証設定

### 1-1. AWS CLIのインストール確認

```bash
aws --version
```

インストールされていない場合：
- macOS: `brew install awscli`
- Linux: `sudo apt-get install awscli` または `sudo yum install awscli`
- Windows: [公式インストーラー](https://aws.amazon.com/cli/)

### 1-2. AWS認証情報の設定

```bash
aws configure
```

以下の情報を入力します：

```
AWS Access Key ID: [あなたのAccess Key ID]
AWS Secret Access Key: [あなたのSecret Access Key]
Default region name: ap-northeast-1
Default output format: json
```

**Access Key IDとSecret Access Keyの取得方法**:
1. AWSコンソールにログイン
2. IAMサービスに移動
3. 「ユーザー」→ 自分のユーザー名を選択
4. 「セキュリティ認証情報」タブ
5. 「アクセスキーを作成」をクリック
6. 表示されたAccess Key IDとSecret Access Keyを保存（Secret Access Keyは2度と表示されません）

### 1-3. 認証確認

```bash
aws sts get-caller-identity
```

正しく設定されていれば、アカウント情報が表示されます。

## ステップ2: CDKのインストールとブートストラップ

### 2-1. CDKのインストール

```bash
npm install -g aws-cdk
cdk --version
```

### 2-2. CDKプロジェクトのセットアップ

```bash
cd apps/qr-attendance/infrastructure/cdk
npm install
```

### 2-3. CDKブートストラップ（初回のみ）

CDKがAWS環境に必要なリソース（S3バケット、IAMロール等）を作成します：

```bash
# 現在のAWSアカウントIDを確認
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=ap-northeast-1

# ブートストラップ実行
cdk bootstrap
```

**注意**: ブートストラップはAWSアカウントごとに1回だけ実行すればOKです。

## ステップ3: AWSリソースの構築

### 3-1. 環境変数の設定

```bash
export CDK_ENV=dev
export CDK_DEFAULT_REGION=ap-northeast-1
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
```

### 3-2. スタックのデプロイ

#### すべてのスタックを一度にデプロイ（推奨）

```bash
cd apps/qr-attendance/infrastructure/cdk
npm run deploy
```

これにより以下が作成されます：
1. **RDSスタック**: VPC、RDS MySQLインスタンス、セキュリティグループ
2. **Cognitoスタック**: User Pool、User Pool Client
3. **APIスタック**: API Gateway、Lambda関数

**所要時間**: 約15-20分（RDSの作成に時間がかかります）

#### 個別にデプロイする場合

```bash
# 1. RDSスタック（最初に作成）
npm run deploy:rds

# 2. Cognitoスタック
npm run deploy:cognito

# 3. APIスタック（RDSとCognitoに依存）
npm run deploy:api
```

### 3-3. デプロイ確認

```bash
# スタック一覧の確認
cdk list

# スタックの状態確認
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
```

## ステップ4: リソース情報の取得と環境変数の設定

### 4-1. RDS接続情報の取得

```bash
# エンドポイント取得
DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name QrAttendanceRdsStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DbEndpoint`].OutputValue' \
  --output text)

echo "DB Endpoint: $DB_ENDPOINT"

# ポート取得
DB_PORT=$(aws cloudformation describe-stacks \
  --stack-name QrAttendanceRdsStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DbPort`].OutputValue' \
  --output text)

echo "DB Port: $DB_PORT"

# Secrets Managerからパスワード取得
DB_SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name QrAttendanceRdsStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DbSecretArn`].OutputValue' \
  --output text)

DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id $DB_SECRET_ARN \
  --query SecretString \
  --output text | jq -r '.password')

echo "DB Password: $DB_PASSWORD"
```

### 4-2. Cognito情報の取得

```bash
# User Pool ID取得
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name QrAttendanceCognitoStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

echo "User Pool ID: $USER_POOL_ID"

# User Pool Client ID取得
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name QrAttendanceCognitoStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

echo "User Pool Client ID: $USER_POOL_CLIENT_ID"
```

### 4-3. API Gateway URL取得

```bash
API_URL=$(aws cloudformation describe-stacks \
  --stack-name QrAttendanceApiStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

echo "API URL: $API_URL"
```

### 4-4. 環境変数ファイルの更新

#### バックエンド（backend/.env）

```bash
cd apps/qr-attendance/backend

cat > .env << EOF
# データベース設定
DB_HOST=$DB_ENDPOINT
DB_PORT=$DB_PORT
DB_USER=admin
DB_PASSWORD=$DB_PASSWORD
DB_NAME=qr_attendance
DB_SSL=true

# AWS Cognito設定
COGNITO_USER_POOL_ID=$USER_POOL_ID
COGNITO_CLIENT_ID=$USER_POOL_CLIENT_ID
AWS_REGION=ap-northeast-1

# API設定
API_BASE_URL=$API_URL
NODE_ENV=development

# JWT設定
JWT_SECRET=your_jwt_secret_here_change_in_production
JWT_EXPIRES_IN=24h

# その他
LOG_LEVEL=debug
EOF
```

#### フロントエンド（frontend/.env.local）

```bash
cd apps/qr-attendance/frontend

cat > .env.local << EOF
# API設定
NEXT_PUBLIC_API_URL=$API_URL

# AWS Cognito設定
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$USER_POOL_CLIENT_ID
NEXT_PUBLIC_AWS_REGION=ap-northeast-1

# その他
NEXT_PUBLIC_APP_NAME=QRコード打刻システム
NEXT_PUBLIC_APP_VERSION=0.1.0
EOF
```

## ステップ5: データベーススキーマの適用

RDSはVPC内のプライベートサブネットにあるため、直接接続できません。以下のいずれかの方法を使用します：

### 方法1: EC2インスタンス経由（推奨）

1. EC2インスタンスを作成（VPC内のパブリックサブネット）
2. EC2にSSH接続
3. EC2からRDSに接続してスキーマを適用

### 方法2: AWS Systems Manager Session Manager経由

```bash
# EC2インスタンスに接続（SSMエージェントが必要）
aws ssm start-session --target i-xxxxxxxxxxxxx

# EC2内でMySQLクライアントをインストール
sudo yum install mysql -y  # Amazon Linuxの場合

# RDSに接続
mysql -h $DB_ENDPOINT -u admin -p$DB_PASSWORD qr_attendance < schema.sql
```

### 方法3: Lambda関数でスキーマ適用（推奨）

Lambda関数を作成してスキーマを適用する方法（後で実装予定）。

## ステップ6: 動作確認

### 6-1. API Gatewayの動作確認

```bash
curl $API_URL/health
```

レスポンスが返ってくればOKです。

### 6-2. RDS接続確認

Lambda関数からRDSへの接続をテスト（後で実装予定）。

## 次のステップ

1. **データベーススキーマの適用**（上記ステップ5）
2. **Lambda関数の実装**（フェーズ2以降）
3. **CI/CDパイプラインの構築**（GitHub Actions）

## トラブルシューティング

### CDKブートストラップエラー

```bash
# リージョンとアカウントIDを明示的に指定
cdk bootstrap aws://ACCOUNT-ID/ap-northeast-1
```

### 権限エラー

IAMユーザーに以下の権限が必要です：
- CloudFormation（完全な権限）
- EC2（VPC、セキュリティグループ作成）
- RDS（インスタンス作成）
- Lambda（関数作成）
- API Gateway（API作成）
- Cognito（User Pool作成）
- Secrets Manager（シークレット作成）
- IAM（ロール作成）

### RDS接続エラー

- セキュリティグループの設定を確認
- VPCの設定を確認
- パスワードが正しいか確認

## 参考資料

- [CDK README](../infrastructure/cdk/README.md)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [RDS接続ガイド](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ConnectToInstance.html)
