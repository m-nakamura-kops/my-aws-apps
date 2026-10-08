# CORSエラー最終修正手順

## 🔍 問題

エラーメッセージ：
```
The 'Access-Control-Allow-Origin' header contains multiple values 
'https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000', 
but only one is allowed.
```

**原因**: API GatewayのOPTIONSメソッドの統合レスポンスで、`Access-Control-Allow-Origin`に複数の値（カンマ区切り）が設定されています。CORSの仕様では、このヘッダーは1つの値しか持てません。

## ✅ 解決策

API GatewayのOPTIONSメソッドの統合レスポンス設定を**削除**してください。プロキシ統合を使用している場合、Lambda関数でCORSヘッダーを返すため、API Gatewayの統合レスポンス設定は不要です。

## 🔧 修正手順（API Gatewayコンソール）

### ステップ1: /tasks リソースのOPTIONSメソッドの統合レスポンス設定を削除

1. [API Gatewayコンソール](https://console.aws.amazon.com/apigateway/)にアクセス
2. `task-management-api` を選択
3. 左側のメニューで「リソース」を選択
4. `/tasks` リソースを選択
5. **OPTIONSメソッド**をクリック
6. **「統合レスポンス」タブ**を選択
7. **ステータスコード200**の統合レスポンスをクリック
8. **「レスポンスパラメータ」**セクションで以下を**削除**：
   - `method.response.header.Access-Control-Allow-Origin` の行を削除
   - `method.response.header.Access-Control-Allow-Methods` の行を削除
   - `method.response.header.Access-Control-Allow-Headers` の行を削除
   
   **削除方法**: 各行の右側にある「×」ボタンをクリック

9. 「保存」をクリック

### ステップ2: /tasks/{taskId} リソースのOPTIONSメソッドも同様に修正

1. `/tasks/{taskId}` リソースを選択
2. **OPTIONSメソッド**を選択
3. **「統合レスポンス」タブ**を選択
4. ステータスコード200の統合レスポンスで、CORSヘッダーの設定を削除
5. 「保存」をクリック

### ステップ3: API Gatewayを再デプロイ

1. 右上の「API アクション」ボタンをクリック
2. 「APIのデプロイ」を選択
3. **デプロイステージ**: `prod` を選択
4. **デプロイの説明**（オプション）: `Remove duplicate CORS headers` と入力
5. **「デプロイ」ボタン**をクリック

### ステップ4: 動作確認

1. ブラウザのキャッシュを完全にクリア（またはシークレットモードで開く）
2. CloudFrontのURLにアクセス: `https://d37xuhikacb4ca.cloudfront.net`
3. ブラウザの開発者ツール（F12）で「Network」タブを開く
4. タスクを追加してみる
5. OPTIONSリクエストのレスポンスヘッダーを確認：
   - `access-control-allow-origin` が**1つの値のみ**になっていることを確認
   - 例: `access-control-allow-origin: https://d37xuhikacb4ca.cloudfront.net`

## 📝 確認方法（curl）

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

**エラーになる結果**（現在の状態）:
```
< access-control-allow-origin: https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000
```

## ⚠️ 重要なポイント

1. **`Access-Control-Allow-Origin`は1つの値しか持てません**
   - 複数のOriginを許可する場合は、リクエストのOriginに基づいて動的に1つの値を返す必要があります

2. **Lambda関数では既に正しく実装されています**
   - Lambda関数はリクエストのOriginに基づいて、適切な1つの値を返します
   - 例: CloudFrontからのリクエスト → `https://d37xuhikacb4ca.cloudfront.net`
   - 例: localhostからのリクエスト → `http://localhost:8000`

3. **API Gatewayの統合レスポンス設定がLambda関数のヘッダーと競合しています**
   - プロキシ統合の場合、Lambda関数のレスポンスヘッダーが優先されます
   - しかし、API Gatewayの統合レスポンス設定も適用されると、ヘッダーが重複してしまいます
   - そのため、統合レスポンス設定を削除してください

## 🔄 修正後の動作

- Lambda関数がリクエストのOriginを確認
- 許可されたOriginの場合、そのOriginを`Access-Control-Allow-Origin`に設定
- 許可されていないOriginの場合、デフォルトでCloudFrontのOriginを設定
- 結果として、`Access-Control-Allow-Origin`は常に1つの値のみになります



