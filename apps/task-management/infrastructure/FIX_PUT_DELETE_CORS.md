# PUT/DELETEメソッドのCORS修正

## 🔍 問題

PUTとDELETEメソッドが動作していません。原因は以下の通りです：

1. **PUT/DELETEメソッドの統合レスポンスで、`Access-Control-Allow-Origin`に複数の値が設定されている**
   - 現在: `'https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000'`
   - 必要: `'https://d37xuhikacb4ca.cloudfront.net'`（1つの値のみ）

2. **`/tasks/{taskId}`リソースのOPTIONSメソッドの統合レスポンスが設定されていない**

## ✅ 修正内容

以下の修正を実施しました：

1. **PUTメソッドの統合レスポンスを修正**
   - `Access-Control-Allow-Origin`を1つの値に変更
   - `Access-Control-Allow-Methods`と`Access-Control-Allow-Headers`を追加

2. **DELETEメソッドの統合レスポンスを修正**
   - `Access-Control-Allow-Origin`を1つの値に変更
   - `Access-Control-Allow-Methods`と`Access-Control-Allow-Headers`を追加

3. **OPTIONSメソッドの統合レスポンスを追加**
   - `/tasks/{taskId}`リソースのOPTIONSメソッドに統合レスポンスを設定

## 🧪 動作確認

### OPTIONSリクエスト（プリフライト）
```bash
curl -X OPTIONS https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod/tasks/test-task-id \
  -H "Origin: https://d37xuhikacb4ca.cloudfront.net" \
  -H "Access-Control-Request-Method: PUT" \
  -v
```

### PUTリクエスト
```bash
curl -X PUT https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod/tasks/test-task-id \
  -H "Origin: https://d37xuhikacb4ca.cloudfront.net" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Task"}' \
  -v
```

### DELETEリクエスト
```bash
curl -X DELETE https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod/tasks/test-task-id \
  -H "Origin: https://d37xuhikacb4ca.cloudfront.net" \
  -v
```

## 📝 次のステップ

1. **ブラウザで動作確認**
   - ブラウザのキャッシュを完全にクリア（またはシークレットモードで開く）
   - CloudFrontのURLにアクセス: `https://d37xuhikacb4ca.cloudfront.net`
   - タスクの編集・削除をテスト

2. **開発者ツールで確認**
   - F12で開発者ツールを開く
   - 「Network」タブでリクエストを確認
   - PUT/DELETEリクエストが正常に動作していることを確認
   - CORSエラーが発生していないことを確認

## ⚠️ 注意事項

- ブラウザのキャッシュをクリアしないと、古いエラーが表示される可能性があります
- CloudFrontのキャッシュが残っている場合は、数分待つか、キャッシュ無効化を実行してください



