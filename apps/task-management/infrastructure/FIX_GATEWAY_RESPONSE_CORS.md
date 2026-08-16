# ゲートウェイレスポンスのCORSヘッダー修正手順

## 🔍 問題の原因

**エラーメッセージ**:
```
The 'Access-Control-Allow-Origin' header contains multiple values 
'https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000', 
but only one is allowed.
```

**原因**: API Gatewayの**ゲートウェイレスポンス**（DEFAULT_4XX、DEFAULT_5XX、UNAUTHORIZED）で、`Access-Control-Allow-Origin`に複数の値（カンマ区切り）が設定されています。

OPTIONSリクエストが500エラーを返しているため、DEFAULT_5XXゲートウェイレスポンスが適用され、そのCORSヘッダーが返されています。

## ✅ 解決策

API Gatewayコンソールで、ゲートウェイレスポンスのCORSヘッダー設定を修正してください。複数の値を1つの値（CloudFrontのみ）に変更します。

## 🔧 修正手順

### ステップ1: DEFAULT_4XXゲートウェイレスポンスを修正

1. [API Gatewayコンソール](https://console.aws.amazon.com/apigateway/)にアクセス
2. `task-management-api` を選択
3. 左側のメニューで**「ゲートウェイのレスポンス」**を選択
4. **「DEFAULT_4XX」**をクリック
5. **「レスポンスパラメータ」**セクションで以下を修正：
   - `gatewayresponse.header.Access-Control-Allow-Origin`
   - **現在の値**: `'https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000'`
   - **変更後**: `'https://d37xuhikacb4ca.cloudfront.net'`
   - ⚠️ **カンマ以降を削除**してください（`http://localhost:8000`を削除）
6. 「保存」をクリック

### ステップ2: DEFAULT_5XXゲートウェイレスポンスを修正

1. **「ゲートウェイのレスポンス」**メニューで**「DEFAULT_5XX」**をクリック
2. **「レスポンスパラメータ」**セクションで以下を修正：
   - `gatewayresponse.header.Access-Control-Allow-Origin`
   - **現在の値**: `'https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000'`
   - **変更後**: `'https://d37xuhikacb4ca.cloudfront.net'`
   - ⚠️ **カンマ以降を削除**してください
3. 「保存」をクリック

### ステップ3: UNAUTHORIZEDゲートウェイレスポンスを修正

1. **「ゲートウェイのレスポンス」**メニューで**「UNAUTHORIZED」**をクリック
2. **「レスポンスパラメータ」**セクションで以下を修正：
   - `gatewayresponse.header.Access-Control-Allow-Origin`
   - **現在の値**: `'https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000'`
   - **変更後**: `'https://d37xuhikacb4ca.cloudfront.net'`
   - ⚠️ **カンマ以降を削除**してください
3. 「保存」をクリック

### ステップ4: OPTIONSメソッドの問題を確認（オプション）

OPTIONSリクエストが500エラーを返している場合、OPTIONSメソッドの設定を確認してください：

1. **「リソース」**メニューを選択
2. `/tasks` リソースを選択
3. **OPTIONSメソッド**をクリック
4. **「統合リクエスト」タブ**を確認
5. **「リクエストテンプレート」**が正しく設定されているか確認
   - MOCK統合の場合、通常は空で問題ありません
   - または、`{}`（空のJSONオブジェクト）に設定

### ステップ5: API Gatewayを再デプロイ

1. 右上の「API アクション」ボタンをクリック
2. 「APIのデプロイ」を選択
3. **デプロイステージ**: `prod` を選択
4. **デプロイの説明**（オプション）: `Fix gateway response CORS headers` と入力
5. **「デプロイ」ボタン**をクリック

### ステップ6: 動作確認

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
< HTTP/2 200
< access-control-allow-origin: https://d37xuhikacb4ca.cloudfront.net
```

**エラーになる結果**（現在の状態）:
```
< HTTP/2 500
< access-control-allow-origin: https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000
```

## ⚠️ 重要なポイント

1. **ゲートウェイレスポンスはエラー時に使用されます**
   - DEFAULT_4XX: 4xxエラー時
   - DEFAULT_5XX: 5xxエラー時
   - UNAUTHORIZED: 認証エラー時

2. **`Access-Control-Allow-Origin`は1つの値しか持てません**
   - 複数のOriginを許可する場合は、リクエストのOriginに基づいて動的に1つの値を返す必要があります
   - ゲートウェイレスポンスでは動的な値の設定が難しいため、本番環境（CloudFront）のみを許可する設定にします

3. **開発環境（localhost）でのテスト**
   - 開発環境でテストする場合は、一時的に`'*'`（すべてのOriginを許可）に設定することもできますが、本番環境では推奨されません
   - または、開発環境用に別のAPI Gatewayステージを作成することを推奨します

## 🔄 修正後の動作

- エラーが発生した場合、ゲートウェイレスポンスのCORSヘッダーが適用されます
- `Access-Control-Allow-Origin`は1つの値（CloudFront）のみになります
- ブラウザがCORSエラーを返さなくなります



