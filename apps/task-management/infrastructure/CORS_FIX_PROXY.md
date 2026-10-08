# プロキシ統合でのCORS修正

## 🔍 問題

プロキシ統合を使用している場合、API Gatewayの統合レスポンスでCORSヘッダーを設定することができません。そのため、Lambda関数でCORSヘッダーを返す必要があります。

## ✅ 修正内容

Lambda関数を修正して、すべてのレスポンスにCORSヘッダーを含めるようにしました。

### 修正された内容

1. **Originヘッダーの取得**: リクエストのOriginヘッダーを取得
2. **許可するOriginのリスト**: CloudFrontとlocalhostを許可
3. **CORSヘッダーの設定**: すべてのレスポンスに以下を追加：
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`
   - `Access-Control-Allow-Headers`

## 🧪 テスト方法

### 1. ブラウザで直接テスト

```
https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod/tasks
```

### 2. curlでテスト

```bash
curl -X GET https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod/tasks \
  -H "Origin: https://d37xuhikacb4ca.cloudfront.net" \
  -v
```

レスポンスヘッダーに以下が含まれていることを確認：
- `access-control-allow-origin: https://d37xuhikacb4ca.cloudfront.net`
- `access-control-allow-methods: GET,POST,PUT,DELETE,OPTIONS`
- `access-control-allow-headers: Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token`

## 📝 注意事項

- Lambda関数のデプロイ後、数秒待ってからテストしてください
- ブラウザのキャッシュをクリアするか、シークレットモードでテストしてください
- CloudFrontのキャッシュが残っている場合は、数分待つか、キャッシュ無効化を実行してください

## 🔄 次のステップ

1. Lambda関数がデプロイされたことを確認
2. CloudFrontのURLで動作確認: `https://d37xuhikacb4ca.cloudfront.net`
3. タスクの取得・追加・編集・削除をテスト



