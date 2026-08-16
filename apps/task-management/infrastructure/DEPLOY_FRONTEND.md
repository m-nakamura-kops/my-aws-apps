# フロントエンドデプロイ手順

タスク管理アプリのフロントエンドをS3 + CloudFrontにデプロイする手順です。

## 📋 前提条件

- AWS CLIがインストール・設定済み
- S3バケットを作成する権限がある
- CloudFrontディストリビューションを作成する権限がある

## 🚀 デプロイ手順

### 1. S3バケットの作成

```bash
# バケット名を設定（一意の名前に変更してください）
BUCKET_NAME="task-management-frontend-$(date +%s)"

# S3バケットを作成
aws s3 mb s3://$BUCKET_NAME --region ap-northeast-1
```

### 2. 静的ファイルのアップロード

```bash
cd apps/task-management/frontend

# 静的ファイルをS3にアップロード
aws s3 sync . s3://$BUCKET_NAME \
  --exclude "*.git*" \
  --exclude "*.DS_Store" \
  --cache-control "max-age=31536000" \
  --region ap-northeast-1
```

### 3. バケットポリシーの設定

```bash
# バケットポリシーを作成
cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF

# バケットポリシーを適用
aws s3api put-bucket-policy \
  --bucket $BUCKET_NAME \
  --policy file:///tmp/bucket-policy.json \
  --region ap-northeast-1
```

### 4. 静的ウェブサイトホスティングの有効化

```bash
aws s3 website s3://$BUCKET_NAME \
  --index-document index.html \
  --error-document index.html \
  --region ap-northeast-1
```

### 5. CloudFrontディストリビューションの作成

```bash
# CloudFront設定ファイルを作成
cat > /tmp/cloudfront-config.json << EOF
{
  "CallerReference": "task-management-$(date +%s)",
  "Comment": "Task Management App Frontend",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-$BUCKET_NAME",
        "DomainName": "$BUCKET_NAME.s3-website.ap-northeast-1.amazonaws.com",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only"
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-$BUCKET_NAME",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "Compress": true
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
EOF

# CloudFrontディストリビューションを作成
aws cloudfront create-distribution \
  --distribution-config file:///tmp/cloudfront-config.json \
  --region ap-northeast-1
```

### 6. APIエンドポイントURLの確認

デプロイ後、フロントエンドの`app.js`でAPIエンドポイントURLが正しく設定されているか確認してください。

現在の設定:
```javascript
const API_BASE_URL = 'https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod';
```

### 7. CORS設定の確認

API GatewayでCORS設定が正しく行われているか確認してください。

## 📝 デプロイ後の確認事項

1. ✅ CloudFrontのURLでアプリが表示される
2. ✅ タスクの追加・編集・削除が動作する
3. ✅ APIエンドポイントが正しく呼び出される
4. ✅ CORSエラーが発生しない

## 🔄 再デプロイ手順

フロントエンドを更新した場合:

```bash
cd apps/task-management/frontend
aws s3 sync . s3://$BUCKET_NAME \
  --exclude "*.git*" \
  --exclude "*.DS_Store" \
  --cache-control "max-age=31536000" \
  --region ap-northeast-1

# CloudFrontのキャッシュを無効化（必要に応じて）
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*" \
  --region ap-northeast-1
```

## 💰 コストについて

- S3: ストレージとリクエスト料金（通常は無料枠内）
- CloudFront: データ転送料金（最初の1TB/月は無料）
- 個人利用では通常無料枠内で収まります

## 🔗 関連ドキュメント

- [README.md](../README.md) - 全体のセットアップ手順
- [TEST_SCENARIOS.md](../TEST_SCENARIOS.md) - テストシナリオ



