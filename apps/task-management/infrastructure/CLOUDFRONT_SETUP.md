# CloudFront設定手順

## ✅ CloudFrontディストリビューション作成完了

### ディストリビューション情報

- **ディストリビューションID**: `E3UN2UEFZ7ZSRY`
- **ドメイン名**: `d37xuhikacb4ca.cloudfront.net`
- **URL**: `https://d37xuhikacb4ca.cloudfront.net`
- **ステータス**: デプロイ中（InProgress）

## ⏳ デプロイ完了まで

CloudFrontディストリビューションのデプロイには通常 **15-20分** かかります。

デプロイ状況を確認するコマンド：

```bash
aws cloudfront get-distribution \
  --id E3UN2UEFZ7ZSRY \
  --query 'Distribution.Status' \
  --output text
```

ステータスが `Deployed` になれば完了です。

## 🔧 デプロイ後の設定

### 1. API GatewayのCORS設定を更新

CloudFrontドメインを許可するようにCORS設定を更新してください：

1. API Gatewayコンソールにアクセス
2. `/tasks` リソースを選択
3. 「CORS を有効にする」をクリック
4. Access-Control-Allow-Origin を以下に変更：
   ```
   https://d37xuhikacb4ca.cloudfront.net
   ```
5. または、開発環境も考慮して：
   ```
   https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000
   ```
6. 「CORSを有効にする」をクリック
7. APIを再デプロイ

### 2. フロントエンドのAPIエンドポイント確認

`frontend/app.js` のAPIエンドポイントURLが正しく設定されているか確認：

```javascript
const API_BASE_URL = 'https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod';
```

### 3. CloudFrontのキャッシュ無効化（必要に応じて）

フロントエンドを更新した場合、CloudFrontのキャッシュを無効化：

```bash
aws cloudfront create-invalidation \
  --distribution-id E3UN2UEFZ7ZSRY \
  --paths "/*" \
  --region ap-northeast-1
```

## 🌐 アクセスURL

### フロントエンド（CloudFront）
```
https://d37xuhikacb4ca.cloudfront.net
```

### バックエンドAPI
```
https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod
```

## ✅ 動作確認チェックリスト

デプロイ完了後、以下を確認してください：

- [ ] CloudFrontのURLでアプリが表示される
- [ ] HTTPSでアクセスできる
- [ ] タスクの追加が動作する
- [ ] タスクの一覧表示が動作する
- [ ] タスクの編集が動作する
- [ ] タスクの削除が動作する
- [ ] CORSエラーが発生しない
- [ ] コンソールにエラーが表示されない

## 🔒 セキュリティ設定

### CloudFrontの設定

- ✅ HTTPS強制（redirect-to-https）
- ✅ TLS 1.2以上
- ✅ 圧縮有効
- ✅ 404エラー時はindex.htmlを返す（SPA対応）

### S3の設定

- ✅ パブリックアクセスはブロック（CloudFront経由でのみアクセス可能）
- ✅ 静的ウェブサイトホスティング有効

## 📊 コスト

- **CloudFront**: 最初の1TB/月のデータ転送は無料
- **S3**: ストレージとリクエスト料金（通常は無料枠内）
- 個人利用では通常無料枠内で収まります

## 🔄 更新手順

フロントエンドを更新した場合：

1. S3にファイルをアップロード
2. CloudFrontのキャッシュを無効化（必要に応じて）

```bash
cd apps/task-management/frontend
aws s3 sync . s3://task-management-frontend-1765093830 \
  --exclude "*.git*" \
  --exclude "*.DS_Store" \
  --cache-control "max-age=31536000" \
  --region ap-northeast-1

# キャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id E3UN2UEFZ7ZSRY \
  --paths "/*" \
  --region ap-northeast-1
```

## 📝 トラブルシューティング

### CloudFrontがデプロイされない

- 15-20分待ってから再度確認
- AWSコンソールでCloudFrontの状態を確認

### CORSエラーが発生する

- API GatewayのCORS設定を確認
- CloudFrontドメインが許可されているか確認
- API Gatewayを再デプロイ

### 404エラーが発生する

- S3バケットの静的ウェブサイトホスティングが有効か確認
- CloudFrontのエラーレスポンス設定を確認

## 📚 関連ドキュメント

- [README.md](../README.md)
- [DEPLOY_STATUS.md](./DEPLOY_STATUS.md)
- [DEPLOY_FRONTEND.md](./DEPLOY_FRONTEND.md)



