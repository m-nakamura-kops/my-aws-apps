# CORS設定の手動修正手順

## 🔍 発見された問題

現在のCORS設定に以下の問題があります：

1. **Access-Control-Allow-Methods** にPUTとDELETEが含まれていない
   - 現在: `GET,OPTIONS,POST`
   - 必要: `GET,POST,PUT,DELETE,OPTIONS`

2. **Access-Control-Allow-Origin** に余分なスペースがある
   - 現在: `'   https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000'`
   - 必要: `'https://d37xuhikacb4ca.cloudfront.net,http://localhost:8000'`

## 🔧 修正手順

### ステップ1: /tasks リソースのOPTIONSメソッドを修正

1. [API Gatewayコンソール](https://console.aws.amazon.com/apigateway/)にアクセス
2. `task-management-api` を選択
3. 「リソース」タブを選択
4. `/tasks` リソースを選択
5. **OPTIONSメソッド**をクリック
6. **「統合レスポンス」タブ**を選択
7. **ステータスコード200**の統合レスポンスをクリック
8. 「レスポンスパラメータ」セクションで以下を確認・修正：

   **Access-Control-Allow-Methods**:
   - 現在の値: `'GET,OPTIONS,POST'`
   - **変更後**: `'GET,POST,PUT,DELETE,OPTIONS'`
   - ⚠️ PUTとDELETEを追加してください

   **Access-Control-Allow-Origin**:
   - 現在の値: `'   https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000'`
   - **変更後**: `'https://d37xuhikacb4ca.cloudfront.net,http://localhost:8000'`
   - ⚠️ 余分なスペースを削除してください

9. 「保存」をクリック

### ステップ2: /tasks/{taskId} リソースのOPTIONSメソッドを確認・作成

1. `/tasks/{taskId}` リソースを選択
2. OPTIONSメソッドが存在するか確認
3. **OPTIONSメソッドが存在しない場合**:
   - 「メソッドを作成」をクリック
   - メソッドタイプ: **OPTIONS** を選択
   - チェックマークをクリック
   - 統合タイプ: **Mock** を選択
   - 「保存」をクリック
   - 「統合レスポンス」タブでCORSヘッダーを設定

4. **OPTIONSメソッドが存在する場合**:
   - OPTIONSメソッドをクリック
   - 「統合レスポンス」タブで同様に修正

### ステップ3: 各メソッド（GET、POST、PUT、DELETE）のCORSヘッダーを確認

各メソッドの統合レスポンスにもCORSヘッダーが必要です：

#### GET /tasks メソッド
1. `/tasks` リソース → GETメソッドを選択
2. 「統合レスポンス」タブ → ステータスコード200を選択
3. レスポンスパラメータに以下があるか確認：
   - `method.response.header.Access-Control-Allow-Origin`
   - `method.response.header.Access-Control-Allow-Methods`
   - `method.response.header.Access-Control-Allow-Headers`

#### POST /tasks メソッド
- 同様に確認

#### PUT /tasks/{taskId} メソッド
- `/tasks/{taskId}` リソース → PUTメソッドを選択
- 同様に確認

#### DELETE /tasks/{taskId} メソッド
- `/tasks/{taskId}` リソース → DELETEメソッドを選択
- 同様に確認

### ステップ4: API Gatewayを再デプロイ

1. API Gatewayコンソールの右上にある**「API アクション」**をクリック
2. **「APIのデプロイ」**を選択
3. **デプロイステージ**: `prod` を選択
4. **デプロイの説明**（オプション）: `Fix CORS headers` と入力
5. **「デプロイ」ボタン**をクリック

### ステップ5: CloudFrontのキャッシュを無効化

CloudFrontのキャッシュが古い可能性があるため、無効化します：

```bash
aws cloudfront create-invalidation \
  --distribution-id E3UN2UEFZ7ZSRY \
  --paths "/*" \
  --region ap-northeast-1
```

または、AWSコンソールで：
1. CloudFrontコンソールにアクセス
2. ディストリビューション `E3UN2UEFZ7ZSRY` を選択
3. 「キャッシュ削除」タブを選択
4. 「キャッシュ削除を作成」をクリック
5. オブジェクトパス: `/*` を入力
6. 「キャッシュ削除を作成」をクリック

### ステップ6: 動作確認

1. スマホのブラウザでキャッシュをクリア
2. CloudFrontのURLにアクセス: `https://d37xuhikacb4ca.cloudfront.net`
3. タスクを追加してみる
4. エラーが解消されているか確認

## 📝 確認チェックリスト

- [ ] `/tasks` リソースのOPTIONSメソッドでPUTとDELETEを追加した
- [ ] `/tasks` リソースのOPTIONSメソッドでOriginのスペースを削除した
- [ ] `/tasks/{taskId}` リソースにOPTIONSメソッドが存在する
- [ ] 各メソッド（GET、POST、PUT、DELETE）の統合レスポンスにCORSヘッダーが設定されている
- [ ] API Gatewayを再デプロイした
- [ ] CloudFrontのキャッシュを無効化した
- [ ] スマホで動作確認した

## 🔗 参考情報

- **API Gateway ID**: `c060m18l73`
- **CloudFront URL**: `https://d37xuhikacb4ca.cloudfront.net`
- **APIエンドポイント**: `https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod`



