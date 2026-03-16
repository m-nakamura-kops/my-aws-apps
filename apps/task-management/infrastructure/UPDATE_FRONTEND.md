# フロントエンド更新手順

## 🔄 ファイルを更新した場合の手順

### 1. ローカルファイルを更新
- `apps/task-management/frontend/` ディレクトリ内のファイルを編集

### 2. S3にファイルをアップロード

```bash
cd apps/task-management/frontend

# app.jsを更新した場合
aws s3 cp app.js s3://task-management-frontend-1765093830/app.js \
  --region ap-northeast-1 \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "application/javascript"

# index.htmlを更新した場合
aws s3 cp index.html s3://task-management-frontend-1765093830/index.html \
  --region ap-northeast-1 \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"

# style.cssを更新した場合
aws s3 cp style.css s3://task-management-frontend-1765093830/style.css \
  --region ap-northeast-1 \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/css"

# すべてのファイルを更新する場合
aws s3 sync . s3://task-management-frontend-1765093830 \
  --exclude "*.git*" \
  --exclude "*.DS_Store" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --region ap-northeast-1
```

### 3. CloudFrontのキャッシュを無効化

```bash
# 特定のファイルのみ無効化
aws cloudfront create-invalidation \
  --distribution-id E3UN2UEFZ7ZSRY \
  --paths "/app.js" \
  --region ap-northeast-1

# すべてのファイルを無効化
aws cloudfront create-invalidation \
  --distribution-id E3UN2UEFZ7ZSRY \
  --paths "/*" \
  --region ap-northeast-1
```

### 4. 動作確認

1. ブラウザのキャッシュを完全にクリア
2. CloudFrontのURLにアクセス: `https://d37xuhikacb4ca.cloudfront.net`
3. 変更が反映されているか確認

## ⚠️ 注意事項

- CloudFrontのキャッシュ無効化には数分かかることがあります
- ブラウザのキャッシュもクリアする必要があります
- 開発中は、`--cache-control "no-cache, no-store, must-revalidate"` を指定してキャッシュを無効化することを推奨します



