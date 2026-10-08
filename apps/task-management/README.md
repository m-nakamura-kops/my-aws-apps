# タスク管理アプリ

AWS Lambda + DynamoDB + API Gateway + S3 + CloudFrontで動作するタスク管理アプリケーションです。

## 📋 機能

- ✅ タスク追加（タイトル、説明、期日、ステータス）
- 📝 タスク一覧表示（更新日時降順）
- ✏️ タスク更新
- 🗑️ タスク削除
- 📱 PWA対応（オフライン閲覧可能）
- 🔐 Cognito認証対応（実装予定）

## 🏗️ アーキテクチャ

```
┌─────────────┐
│   CloudFront │ (HTTPS配信)
└──────┬──────┘
       │
┌──────▼──────┐
│  S3 Bucket  │ (静的ファイル)
└─────────────┘

┌─────────────┐
│ API Gateway │ (REST API)
└──────┬──────┘
       │
┌──────▼──────┐
│   Lambda     │ (Node.js 18.x)
└──────┬──────┘
       │
┌──────▼──────┐
│  DynamoDB    │ (Tasksテーブル)
└─────────────┘
```

## 📁 プロジェクト構造

```
task-management/
├── lambda/              # Lambda関数
│   ├── index.js        # メインLambda関数
│   └── package.json    # 依存関係
├── frontend/           # フロントエンド
│   ├── index.html      # メインHTML
│   ├── app.js          # JavaScript
│   ├── style.css       # スタイルシート
│   ├── manifest.json   # PWA設定
│   └── sw.js           # Service Worker
├── infrastructure/     # インフラ設定（CloudFormation等）
└── README.md           # このファイル
```

## 🚀 セットアップ手順

### 1. DynamoDBテーブルの作成

```bash
aws dynamodb create-table \
  --table-name Tasks \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=taskId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=taskId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --tags \
    Key=Project,Value=TaskApp \
    Key=Env,Value=Dev \
    Key=Owner,Value=YourName
```

### 2. Lambda関数のデプロイ

#### 2.1 依存関係のインストール

```bash
cd lambda
npm install
```

#### 2.2 Lambda関数のパッケージ化

```bash
# ZIPファイルを作成（node_modulesを含む）
zip -r function.zip . -x "*.git*" "*.zip"
```

#### 2.3 Lambda関数の作成

```bash
aws lambda create-function \
  --function-name task-management-api \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --environment Variables="{TASKS_TABLE_NAME=Tasks,AWS_REGION=ap-northeast-1}" \
  --tags Project=TaskApp,Env=Dev,Owner=YourName
```

#### 2.4 Lambda関数の更新（再デプロイ時）

```bash
aws lambda update-function-code \
  --function-name task-management-api \
  --zip-file fileb://function.zip
```

### 3. API Gatewayの設定

#### 3.1 REST APIの作成

```bash
aws apigateway create-rest-api \
  --name task-management-api \
  --description "Task Management API" \
  --endpoint-configuration types=REGIONAL
```

#### 3.2 リソースとメソッドの作成

API GatewayのコンソールまたはAWS CLIで以下を設定：

- `POST /tasks` → Lambda関数を統合
- `GET /tasks` → Lambda関数を統合
- `PUT /tasks/{taskId}` → Lambda関数を統合
- `DELETE /tasks/{taskId}` → Lambda関数を統合

#### 3.3 CORS設定

各メソッドでCORSを有効化：
- Access-Control-Allow-Origin: `https://YOUR_CLOUDFRONT_DOMAIN.cloudfront.net`
- Access-Control-Allow-Headers: `Content-Type,Authorization`
- Access-Control-Allow-Methods: `GET,POST,PUT,DELETE,OPTIONS`

#### 3.4 デプロイ

```bash
aws apigateway create-deployment \
  --rest-api-id YOUR_API_ID \
  --stage-name prod
```

### 4. S3バケットの作成とフロントエンドのデプロイ

#### 4.1 S3バケットの作成

```bash
aws s3 mb s3://task-management-frontend-YOUR_NAME
```

#### 4.2 静的ファイルのアップロード

```bash
cd frontend
aws s3 sync . s3://task-management-frontend-YOUR_NAME \
  --exclude "*.git*" \
  --cache-control "max-age=31536000"
```

#### 4.3 バケットポリシーの設定

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::task-management-frontend-YOUR_NAME/*"
    }
  ]
}
```

#### 4.4 静的ウェブサイトホスティングの有効化

```bash
aws s3 website s3://task-management-frontend-YOUR_NAME \
  --index-document index.html \
  --error-document index.html
```

### 5. CloudFrontディストリビューションの作成

```bash
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json
```

`cloudfront-config.json`の例：

```json
{
  "CallerReference": "task-management-2024",
  "Comment": "Task Management App",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-task-management-frontend",
        "DomainName": "task-management-frontend-YOUR_NAME.s3.ap-northeast-1.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-task-management-frontend",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000
  },
  "Enabled": true
}
```

### 6. フロントエンドのAPIエンドポイント設定

`frontend/app.js`の`API_BASE_URL`を実際のAPI Gatewayエンドポイントに変更：

```javascript
const API_BASE_URL = 'https://YOUR_API_ID.execute-api.ap-northeast-1.amazonaws.com/prod';
```

## 🔐 IAMロールの設定

Lambda実行ロールに以下の権限を付与：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:ap-northeast-1:YOUR_ACCOUNT_ID:table/Tasks"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

## 📊 監視設定

### CloudWatch Alarms

#### API Gateway 5XX率の監視

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name task-api-5xx-rate \
  --alarm-description "API Gateway 5XX error rate" \
  --metric-name 5XXError \
  --namespace AWS/ApiGateway \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold
```

#### Lambdaエラーレートの監視

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name task-lambda-errors \
  --alarm-description "Lambda error rate" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=task-management-api
```

## 🧪 ローカルテスト

### Lambda関数のローカルテスト

```bash
# テストイベントファイルを作成
cat > test-event.json << EOF
{
  "httpMethod": "GET",
  "path": "/tasks",
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "test-user-123"
      }
    }
  }
}
EOF

# Lambda関数をローカルで実行（SAM CLI使用）
sam local invoke TaskManagementFunction --event test-event.json
```

### フロントエンドのローカルテスト

```bash
cd frontend
# 簡易HTTPサーバーで起動
python3 -m http.server 8000
# または
npx serve .
```

ブラウザで `http://localhost:8000` にアクセス。

## 🔄 次期リリース予定

- [ ] Cognito認証の実装
- [ ] Googleカレンダー同期機能
- [ ] タスクのフィルタリング・検索機能
- [ ] タスクの並び替え機能
- [ ] バルク操作（複数タスクの一括削除など）

## 📝 注意事項

- 現在の実装では認証なしで動作します（テストユーザーID: `test-user`）
- 本番環境では必ずCognito認証を実装してください
- API GatewayのCORS設定は本番環境のCloudFrontドメインのみ許可してください
- DynamoDBの暗号化は有効化することを推奨します

## 📄 ライセンス

MIT License

