# Infrastructure as Code (AWS CDK)

## 概要

QRコード打刻システムのAWSインフラストラクチャをCDKで定義します。

## スタック構成

- **QrAttendanceRdsStack**: RDS MySQLインスタンス、VPC、セキュリティグループ
- **QrAttendanceCognitoStack**: Cognito User Pool、User Pool Client
- **QrAttendanceApiStack**: API Gateway、Lambda関数

## 前提条件

### 1. AWS CLIのインストールと認証

```bash
# AWS CLIのインストール確認
aws --version

# 認証情報の設定
aws configure
```

以下の情報を入力：
- AWS Access Key ID
- AWS Secret Access Key
- Default region name: `ap-northeast-1`
- Default output format: `json`

### 2. CDKのインストール

```bash
npm install -g aws-cdk
cdk --version
```

### 3. CDKブートストラップ（初回のみ）

```bash
cd apps/qr-attendance/infrastructure/cdk
npm install
cdk bootstrap
```

## デプロイ手順

### 1. 環境変数の設定

```bash
# 開発環境
export CDK_ENV=dev
export CDK_DEFAULT_REGION=ap-northeast-1

# AWSアカウントIDを確認
aws sts get-caller-identity --query Account --output text
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
```

### 2. スタックのデプロイ

#### すべてのスタックをデプロイ

```bash
npm run deploy
```

#### 個別にデプロイ

```bash
# RDSスタックのみ
npm run deploy:rds

# Cognitoスタックのみ
npm run deploy:cognito

# APIスタックのみ
npm run deploy:api
```

### 3. デプロイ確認

```bash
# スタック一覧の確認
cdk list

# スタックの差分確認
cdk diff

# スタックの詳細確認
aws cloudformation describe-stacks --stack-name QrAttendanceRdsStack-dev
```

## リソース情報の取得

### RDS接続情報の取得

```bash
# エンドポイント取得
aws cloudformation describe-stacks \
  --stack-name QrAttendanceRdsStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DbEndpoint`].OutputValue' \
  --output text

# Secrets Managerからパスワード取得
aws secretsmanager get-secret-value \
  --secret-id $(aws cloudformation describe-stacks \
    --stack-name QrAttendanceRdsStack-dev \
    --query 'Stacks[0].Outputs[?OutputKey==`DbSecretArn`].OutputValue' \
    --output text) \
  --query SecretString \
  --output text | jq -r '.password'
```

### Cognito情報の取得

```bash
# User Pool ID取得
aws cloudformation describe-stacks \
  --stack-name QrAttendanceCognitoStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text

# User Pool Client ID取得
aws cloudformation describe-stacks \
  --stack-name QrAttendanceCognitoStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text
```

### API Gateway URL取得

```bash
aws cloudformation describe-stacks \
  --stack-name QrAttendanceApiStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

## データベーススキーマの適用

RDSが作成されたら、スキーマを適用します：

```bash
# 接続情報を取得
DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name QrAttendanceRdsStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DbEndpoint`].OutputValue' \
  --output text)

DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id $(aws cloudformation describe-stacks \
    --stack-name QrAttendanceRdsStack-dev \
    --query 'Stacks[0].Outputs[?OutputKey==`DbSecretArn`].OutputValue' \
    --output text) \
  --query SecretString \
  --output text | jq -r '.password')

# スキーマ適用（MySQLクライアントが必要）
mysql -h $DB_ENDPOINT -u admin -p$DB_PASSWORD qr_attendance < ../../database/schema.sql
```

**注意**: RDSはVPC内のプライベートサブネットにあるため、ローカルから直接接続できません。
以下のいずれかの方法を使用してください：
1. EC2インスタンス経由で接続
2. AWS Systems Manager Session Manager経由
3. 一時的にパブリックアクセスを有効化（開発環境のみ）

## スタックの削除

```bash
# すべてのスタックを削除
npm run destroy

# または個別に削除
cdk destroy QrAttendanceApiStack-dev
cdk destroy QrAttendanceCognitoStack-dev
cdk destroy QrAttendanceRdsStack-dev
```

## トラブルシューティング

### CDKブートストラップエラー

```bash
# リージョンを指定してブートストラップ
cdk bootstrap aws://ACCOUNT-ID/ap-northeast-1
```

### 権限エラー

IAMユーザーに以下の権限が必要です：
- CloudFormation
- EC2
- RDS
- Lambda
- API Gateway
- Cognito
- Secrets Manager
- VPC

### VPC制限エラー

AWSアカウントのVPC数制限に達している場合、既存のVPCを使用するようにコードを修正してください。

## 参考資料

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CDK Workshop](https://cdkworkshop.com/)
