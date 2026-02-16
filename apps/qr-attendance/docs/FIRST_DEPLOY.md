# 最初のデプロイ手順

## 「AWS上にDBの箱を作る」ための最初のアクション

このガイドでは、AWS上にRDS（MySQL）を構築するための最初のステップを説明します。

## 前提条件チェック

以下のコマンドで必要なツールがインストールされているか確認してください：

```bash
# AWS CLI
aws --version
# 出力例: aws-cli/2.x.x

# Node.js
node --version
# 出力例: v18.x.x 以上

# CDK
cdk --version
# 出力例: 2.x.x
```

## ステップ1: AWS CLIの認証設定（5分）

### 1-1. AWS認証情報の設定

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
1. [AWSコンソール](https://console.aws.amazon.com/)にログイン
2. 右上のユーザー名をクリック → 「セキュリティ認証情報」
3. 「アクセスキー」セクションで「アクセスキーを作成」
4. 用途を選択（「コマンドラインインターフェース (CLI)」を推奨）
5. 表示されたAccess Key IDとSecret Access Keyをコピー
   - **重要**: Secret Access Keyは2度と表示されません。必ず保存してください

### 1-2. 認証確認

```bash
aws sts get-caller-identity
```

正しく設定されていれば、以下のような出力が表示されます：

```json
{
    "UserId": "AIDA...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

## ステップ2: CDKのインストール（2分）

```bash
npm install -g aws-cdk
cdk --version
```

## ステップ3: CDKプロジェクトのセットアップ（3分）

```bash
cd apps/qr-attendance/infrastructure/cdk
npm install
```

## ステップ4: CDKブートストラップ（5分）

**重要**: これはAWSアカウントごとに1回だけ実行すればOKです。

```bash
# 現在のAWSアカウントIDを確認
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=ap-northeast-1

# ブートストラップ実行
cdk bootstrap
```

出力例：
```
 ⏳  Bootstrapping environment aws://123456789012/ap-northeast-1...
...
 ✅  Environment aws://123456789012/ap-northeast-1 bootstrapped.
```

## ステップ5: RDSスタックのデプロイ（15-20分）

### 5-1. 環境変数の設定

```bash
export CDK_ENV=dev
export CDK_DEFAULT_REGION=ap-northeast-1
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
```

### 5-2. RDSスタックのデプロイ

```bash
npm run deploy:rds
```

**所要時間**: 約15-20分（RDSインスタンスの作成に時間がかかります）

デプロイ中は以下のような出力が表示されます：

```
QrAttendanceRdsStack-dev: deploying...
QrAttendanceRdsStack-dev: creating CloudFormation changeset...
...
 ✅  QrAttendanceRdsStack-dev
```

### 5-3. デプロイ確認

```bash
# スタックの状態確認
aws cloudformation describe-stacks \
  --stack-name QrAttendanceRdsStack-dev \
  --query 'Stacks[0].StackStatus' \
  --output text

# 出力が "CREATE_COMPLETE" であれば成功
```

## ステップ6: RDS接続情報の取得（2分）

```bash
# エンドポイント取得
DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name QrAttendanceRdsStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DbEndpoint`].OutputValue' \
  --output text)

echo "DB Endpoint: $DB_ENDPOINT"
# 出力例: qrattendancerdsstack-dev-databaseinstance-xxxxx.ap-northeast-1.rds.amazonaws.com

# ポート取得
DB_PORT=$(aws cloudformation describe-stacks \
  --stack-name QrAttendanceRdsStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DbPort`].OutputValue' \
  --output text)

echo "DB Port: $DB_PORT"
# 出力例: 3306

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

**注意**: `jq`コマンドが必要です。インストールされていない場合：
- macOS: `brew install jq`
- Linux: `sudo apt-get install jq` または `sudo yum install jq`

## ステップ7: 環境変数ファイルの更新（2分）

取得した情報を`backend/.env`に反映します：

```bash
cd ../../backend

cat > .env << EOF
# データベース設定
DB_HOST=$DB_ENDPOINT
DB_PORT=$DB_PORT
DB_USER=admin
DB_PASSWORD=$DB_PASSWORD
DB_NAME=qr_attendance
DB_SSL=true

# AWS Cognito設定（後で設定）
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
AWS_REGION=ap-northeast-1

# API設定（後で設定）
API_BASE_URL=
NODE_ENV=development

# JWT設定
JWT_SECRET=your_jwt_secret_here_change_in_production
JWT_EXPIRES_IN=24h

# その他
LOG_LEVEL=debug
EOF

echo ".envファイルを更新しました"
cat .env
```

## 完了！

これで「AWS上にDBの箱を作る」作業が完了しました！

## 次のステップ

1. **Cognitoスタックのデプロイ**
   ```bash
   cd ../infrastructure/cdk
   npm run deploy:cognito
   ```

2. **APIスタックのデプロイ**
   ```bash
   npm run deploy:api
   ```

3. **データベーススキーマの適用**
   - [AWS_SETUP_GUIDE.md](./AWS_SETUP_GUIDE.md)の「ステップ5: データベーススキーマの適用」を参照

## トラブルシューティング

### CDKブートストラップエラー

```bash
# リージョンとアカウントIDを明示的に指定
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1
```

### 権限エラー

IAMユーザーに以下の権限が必要です：
- `CloudFormationFullAccess`
- `EC2FullAccess`（またはVPC関連の権限）
- `RDSFullAccess`（またはRDS作成権限）
- `SecretsManagerFullAccess`（またはシークレット作成権限）

### RDSデプロイが遅い

RDSインスタンスの作成には15-20分かかります。これは正常です。CloudFormationコンソールで進捗を確認できます。

## 参考資料

- [AWS_SETUP_GUIDE.md](./AWS_SETUP_GUIDE.md) - 詳細なセットアップガイド
- [CDK README](../infrastructure/cdk/README.md) - CDKプロジェクトの詳細
