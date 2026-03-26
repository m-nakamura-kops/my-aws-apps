# PUT/DELETEメソッドのCORS修正手順（手動）

## 🔍 問題

PUTとDELETEメソッドが動作していません。原因は以下の通りです：

1. **PUT/DELETEメソッドのメソッドレスポンスにCORSヘッダーが定義されていない**
2. **PUT/DELETEメソッドの統合レスポンスで、`Access-Control-Allow-Origin`に複数の値が設定されている**

## 🔧 修正手順

### ステップ1: PUTメソッドのメソッドレスポンスを設定

1. API Gatewayコンソールで `/tasks/{taskId}` リソースを選択
2. **PUTメソッド**をクリック
3. **「メソッドレスポンス」タブ**を選択
4. ステータスコード200を選択
5. **「レスポンスヘッダー」**セクションで以下を追加：
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`
   - `Access-Control-Allow-Headers`
6. 「保存」をクリック

### ステップ2: PUTメソッドの統合レスポンスを修正

1. **「統合レスポンス」タブ**を選択
2. ステータスコード200の統合レスポンスを選択
3. **「レスポンスパラメータ」**セクションで以下を設定：

   ```
   method.response.header.Access-Control-Allow-Origin = 'https://d37xuhikacb4ca.cloudfront.net'
   method.response.header.Access-Control-Allow-Methods = 'GET,POST,PUT,DELETE,OPTIONS'
   method.response.header.Access-Control-Allow-Headers = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
   ```

   **重要**: 
   - 値は1つのOriginのみ（カンマ区切りではない）
   - 現在の値に `, http://localhost:8000` が含まれている場合は削除

4. 「保存」をクリック

### ステップ3: DELETEメソッドのメソッドレスポンスを設定

1. `/tasks/{taskId}` リソースで **DELETEメソッド**を選択
2. **「メソッドレスポンス」タブ**を選択
3. ステータスコード200を選択
4. **「レスポンスヘッダー」**セクションで以下を追加：
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`
   - `Access-Control-Allow-Headers`
5. 「保存」をクリック

### ステップ4: DELETEメソッドの統合レスポンスを修正

1. **「統合レスポンス」タブ**を選択
2. ステータスコード200の統合レスポンスを選択
3. **「レスポンスパラメータ」**セクションで以下を設定：

   ```
   method.response.header.Access-Control-Allow-Origin = 'https://d37xuhikacb4ca.cloudfront.net'
   method.response.header.Access-Control-Allow-Methods = 'GET,POST,PUT,DELETE,OPTIONS'
   method.response.header.Access-Control-Allow-Headers = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
   ```

   **重要**: 
   - 値は1つのOriginのみ（カンマ区切りではない）
   - 現在の値に `, http://localhost:8000` が含まれている場合は削除

4. 「保存」をクリック

### ステップ5: OPTIONSメソッドのメソッドレスポンスを確認

1. `/tasks/{taskId}` リソースで **OPTIONSメソッド**を選択
2. **「メソッドレスポンス」タブ**を選択
3. ステータスコード200を選択
4. **「レスポンスヘッダー」**に以下が定義されているか確認：
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`
   - `Access-Control-Allow-Headers`
5. 定義されていない場合は追加して「保存」

### ステップ6: API Gatewayを再デプロイ

1. 「API アクション」→「APIのデプロイ」
2. ステージ: `prod` を選択
3. 「デプロイ」をクリック

### ステップ7: 動作確認

1. ブラウザのキャッシュを完全にクリア（またはシークレットモードで開く）
2. CloudFrontのURLにアクセス: `https://d37xuhikacb4ca.cloudfront.net`
3. タスクの編集・削除をテスト
4. ブラウザの開発者ツール（F12）で「Network」タブを開き、以下を確認：
   - PUT/DELETEリクエストが正常に動作している
   - CORSエラーが発生していない

## 📝 確認チェックリスト

- [ ] PUTメソッドのメソッドレスポンスにCORSヘッダーが定義されている
- [ ] PUTメソッドの統合レスポンスでCORSヘッダーの値が1つのOriginのみになっている
- [ ] DELETEメソッドのメソッドレスポンスにCORSヘッダーが定義されている
- [ ] DELETEメソッドの統合レスポンスでCORSヘッダーの値が1つのOriginのみになっている
- [ ] OPTIONSメソッドのメソッドレスポンスにCORSヘッダーが定義されている
- [ ] API Gatewayを再デプロイした
- [ ] ブラウザで動作確認した

## ⚠️ 重要なポイント

- **メソッドレスポンス**と**統合レスポンス**の両方で設定する必要があります
- `Access-Control-Allow-Origin`は1つの値しか持てません
- カンマ区切りの複数の値は削除してください



