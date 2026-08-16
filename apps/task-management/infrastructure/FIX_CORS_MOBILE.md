# スマホでのCORSエラー修正手順

## 📋 問題

スマホで「Failed to fetch」エラーが発生しています。これはCORS（Cross-Origin Resource Sharing）の設定が原因です。

## 🔧 修正手順

### ステップ1: API GatewayのCORS設定を更新

1. [API Gatewayコンソール](https://console.aws.amazon.com/apigateway/)にアクセス
2. `task-management-api` を選択
3. **「リソース」タブ**を選択
4. `/tasks` リソースを選択
5. **「CORS を有効にする」ボタン**をクリック

### ステップ2: CORS設定の入力

CORS設定画面で以下を設定：

1. **Access-Control-Allow-Origin**:
   ```
   https://d37xuhikacb4ca.cloudfront.net
   ```
   または、開発環境も考慮して：
   ```
   https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000
   ```

2. **Access-Control-Allow-Headers**:
   ```
   Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token
   ```

3. **Access-Control-Allow-Methods**:
   - GET
   - POST
   - PUT
   - DELETE
   - OPTIONS

4. **Access-Control-Max-Age**（オプション）:
   ```
   3600
   ```

5. **「CORSを有効にして既存のCORSヘッダーを置き換える」**を選択

6. **「CORSを有効にする」ボタン**をクリック

### ステップ3: /tasks/{taskId} リソースにもCORSを設定

1. `/tasks/{taskId}` リソースを選択
2. 同様に「CORS を有効にする」をクリック
3. 同じ設定を適用

### ステップ4: API Gatewayを再デプロイ

1. API Gatewayコンソールの右上にある**「API アクション」**をクリック
2. **「APIのデプロイ」**を選択
3. **デプロイステージ**: `prod` を選択
4. **デプロイの説明**（オプション）: `Update CORS for CloudFront` と入力
5. **「デプロイ」ボタン**をクリック

### ステップ5: 動作確認

1. スマホでCloudFrontのURLにアクセス: `https://d37xuhikacb4ca.cloudfront.net`
2. タスクを追加してみる
3. エラーが解消されているか確認

## 🔍 トラブルシューティング

### まだエラーが出る場合

1. **ブラウザのキャッシュをクリア**
   - スマホのブラウザでキャッシュをクリア
   - または、シークレットモードで開く

2. **APIエンドポイントURLを確認**
   - `frontend/app.js` の `API_BASE_URL` が正しいか確認
   - 現在の設定: `https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod`

3. **ネットワーク接続を確認**
   - Wi-Fiまたはモバイルデータが正常に接続されているか確認

4. **ブラウザのコンソールを確認**
   - スマホのブラウザで開発者ツールを開く（可能な場合）
   - エラーメッセージの詳細を確認

## 📝 確認チェックリスト

- [ ] `/tasks` リソースにCORSを設定した
- [ ] `/tasks/{taskId}` リソースにCORSを設定した
- [ ] Access-Control-Allow-OriginにCloudFrontドメインを設定した
- [ ] API Gatewayを再デプロイした
- [ ] スマホで動作確認した

## 🔗 参考情報

- **CloudFront URL**: `https://d37xuhikacb4ca.cloudfront.net`
- **APIエンドポイント**: `https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod`
- **API Gateway ID**: `c060m18l73`



