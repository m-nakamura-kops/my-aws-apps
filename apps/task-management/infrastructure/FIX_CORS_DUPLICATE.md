# CORS重複ヘッダー修正手順

## 🔍 問題

エラーメッセージ：
```
The 'Access-Control-Allow-Origin' header contains multiple values 
'https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000', 
but only one is allowed.
```

**原因**: API GatewayのOPTIONSメソッドの統合レスポンスで、`Access-Control-Allow-Origin`に複数の値（カンマ区切り）が設定されています。CORSの仕様では、このヘッダーは1つの値しか持てません。

## ✅ 解決策

API GatewayのOPTIONSメソッドの統合レスポンス設定を削除するか、Lambda関数のCORSヘッダーのみを使用するようにします。

**注意**: プロキシ統合を使用している場合、Lambda関数でCORSヘッダーを返す方が適切です。API Gatewayの統合レスポンス設定は削除してください。

## 🔧 修正手順

### ステップ1: /tasks リソースのOPTIONSメソッドの統合レスポンス設定を削除

1. API Gatewayコンソールで `/tasks` リソースを選択
2. **OPTIONSメソッド**をクリック
3. **「統合レスポンス」タブ**を選択
4. ステータスコード200の統合レスポンスを展開
5. **「レスポンスパラメータ」**セクションで以下を削除：
   - `method.response.header.Access-Control-Allow-Origin`
   - `method.response.header.Access-Control-Allow-Methods`
   - `method.response.header.Access-Control-Allow-Headers`
   
   **または、統合レスポンス全体を削除**（プロキシ統合の場合、統合レスポンスは不要）

6. 「保存」をクリック

### ステップ2: /tasks/{taskId} リソースのOPTIONSメソッドも同様に修正

1. `/tasks/{taskId}` リソースを選択
2. **OPTIONSメソッド**を選択
3. **「統合レスポンス」タブ**で統合レスポンス設定を削除
4. 「保存」をクリック

### ステップ3: API Gatewayを再デプロイ

1. 「API アクション」→「APIのデプロイ」
2. ステージ: `prod` を選択
3. 「デプロイ」をクリック

### ステップ4: 動作確認

1. ブラウザのキャッシュをクリア（またはシークレットモードで開く）
2. CloudFrontのURLにアクセス: `https://d37xuhikacb4ca.cloudfront.net`
3. ブラウザの開発者ツール（F12）で「Network」タブを開く
4. タスクを追加してみる
5. OPTIONSリクエストのレスポンスヘッダーを確認：
   - `access-control-allow-origin` が1つの値のみになっていることを確認

## 📝 確認方法

curlでテスト：

```bash
curl -X OPTIONS https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod/tasks \
  -H "Origin: https://d37xuhikacb4ca.cloudfront.net" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

**期待される結果**:
```
< access-control-allow-origin: https://d37xuhikacb4ca.cloudfront.net
```

**エラーになる結果**:
```
< access-control-allow-origin: https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000
```

## ⚠️ 重要なポイント

- `Access-Control-Allow-Origin`は1つの値しか持てません
- 複数のOriginを許可する場合は、リクエストのOriginに基づいて動的に1つの値を返す必要があります
- Lambda関数では既に正しく実装されています（リクエストのOriginに基づいて1つの値を返す）
- API Gatewayの統合レスポンス設定がLambda関数のヘッダーと競合しているため、統合レスポンス設定を削除してください



