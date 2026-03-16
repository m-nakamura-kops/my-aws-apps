# OPTIONSメソッドの修正手順

## 🔍 問題

OPTIONSリクエストが500エラーを返しています。これは、OPTIONSメソッドの統合レスポンスが設定されていないためです。

## 🔧 修正手順

### ステップ1: OPTIONSメソッドの統合レスポンスを設定

1. API Gatewayコンソールで `/tasks` リソースを選択
2. **OPTIONSメソッド**をクリック
3. **「統合レスポンス」タブ**を選択
4. **ステータスコード200**を追加（存在しない場合）
5. **「レスポンスパラメータ」**セクションで以下を追加：

   ```
   method.response.header.Access-Control-Allow-Origin = 'https://d37xuhikacb4ca.cloudfront.net'
   method.response.header.Access-Control-Allow-Methods = 'GET,POST,PUT,DELETE,OPTIONS'
   method.response.header.Access-Control-Allow-Headers = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
   ```

   **重要**: 
   - 値は1つのOriginのみ（カンマ区切りではない）
   - シングルクォートで囲む

6. **「メソッドレスポンス」タブ**も確認：
   - ステータスコード200を選択
   - 「レスポンスヘッダー」に以下が定義されているか確認：
     - `Access-Control-Allow-Origin`
     - `Access-Control-Allow-Methods`
     - `Access-Control-Allow-Headers`
   - 定義されていない場合は追加

7. 「保存」をクリック

### ステップ2: /tasks/{taskId} リソースのOPTIONSメソッドも同様に設定

1. `/tasks/{taskId}` リソースを選択
2. **OPTIONSメソッド**を選択
3. 同様に統合レスポンスとメソッドレスポンスを設定

### ステップ3: API Gatewayを再デプロイ

1. 「API アクション」→「APIのデプロイ」
2. ステージ: `prod` を選択
3. 「デプロイ」をクリック

### ステップ4: 動作確認

```bash
curl -X OPTIONS https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod/tasks \
  -H "Origin: https://d37xuhikacb4ca.cloudfront.net" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

期待される結果:
```
< HTTP/2 200
< access-control-allow-origin: https://d37xuhikacb4ca.cloudfront.net
```



