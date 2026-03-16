# CORS完全修正手順

## 🔍 問題の原因

1. **Lambda関数でCORSヘッダーを設定していた** → ✅ 修正済み（削除）
2. **GET/POST/PUT/DELETEメソッドの統合レスポンスにCORSヘッダーが不完全**
   - Access-Control-Allow-Originに余分なスペースがある
   - Access-Control-Allow-MethodsとAccess-Control-Allow-Headersが設定されていない

## 🔧 修正手順

### ステップ1: GETメソッドのCORSヘッダーを修正

1. API Gatewayコンソールで `/tasks` リソースを選択
2. **GETメソッド**をクリック
3. **「統合レスポンス」タブ**を選択
4. ステータスコード200の統合レスポンスを展開
5. **「レスポンスパラメータ」**セクションで以下を設定：

   ```
   method.response.header.Access-Control-Allow-Origin = 'https://d37xuhikacb4ca.cloudfront.net,http://localhost:8000'
   method.response.header.Access-Control-Allow-Methods = 'GET,POST,PUT,DELETE,OPTIONS'
   method.response.header.Access-Control-Allow-Headers = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
   ```

   **重要**: 
   - 値に余分なスペースを入れない
   - シングルクォートで囲む
   - カンマの後にスペースを入れない（`https://...,http://...`）

6. **「メソッドレスポンス」タブ**も確認：
   - ステータスコード200を選択
   - 「レスポンスヘッダー」に以下が定義されているか確認：
     - `Access-Control-Allow-Origin`
     - `Access-Control-Allow-Methods`
     - `Access-Control-Allow-Headers`
   - 定義されていない場合は追加

7. 「保存」をクリック

### ステップ2: POSTメソッドのCORSヘッダーを修正

1. `/tasks` リソースで **POSTメソッド**を選択
2. **「統合レスポンス」タブ**でステータスコード200を選択
3. **「レスポンスパラメータ」**で以下を設定：

   ```
   method.response.header.Access-Control-Allow-Origin = 'https://d37xuhikacb4ca.cloudfront.net,http://localhost:8000'
   method.response.header.Access-Control-Allow-Methods = 'GET,POST,PUT,DELETE,OPTIONS'
   method.response.header.Access-Control-Allow-Headers = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
   ```

4. **「メソッドレスポンス」タブ**でCORSヘッダーが定義されているか確認
5. 「保存」をクリック

### ステップ3: PUTメソッドのCORSヘッダーを修正

1. `/tasks/{taskId}` リソースを選択
2. **PUTメソッド**を選択
3. **「統合レスポンス」タブ**でステータスコード200を選択
4. **「レスポンスパラメータ」**で以下を設定：

   ```
   method.response.header.Access-Control-Allow-Origin = 'https://d37xuhikacb4ca.cloudfront.net,http://localhost:8000'
   method.response.header.Access-Control-Allow-Methods = 'GET,POST,PUT,DELETE,OPTIONS'
   method.response.header.Access-Control-Allow-Headers = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
   ```

5. **「メソッドレスポンス」タブ**でCORSヘッダーが定義されているか確認
6. 「保存」をクリック

### ステップ4: DELETEメソッドのCORSヘッダーを修正

1. `/tasks/{taskId}` リソースで **DELETEメソッド**を選択
2. **「統合レスポンス」タブ**でステータスコード200を選択
3. **「レスポンスパラメータ」**で以下を設定：

   ```
   method.response.header.Access-Control-Allow-Origin = 'https://d37xuhikacb4ca.cloudfront.net,http://localhost:8000'
   method.response.header.Access-Control-Allow-Methods = 'GET,POST,PUT,DELETE,OPTIONS'
   method.response.header.Access-Control-Allow-Headers = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
   ```

4. **「メソッドレスポンス」タブ**でCORSヘッダーが定義されているか確認
5. 「保存」をクリック

### ステップ5: OPTIONSメソッドの確認（既に設定済みのはず）

1. `/tasks` リソースで **OPTIONSメソッド**を選択
2. **「統合レスポンス」タブ**で以下を確認：

   ```
   method.response.header.Access-Control-Allow-Origin = 'https://d37xuhikacb4ca.cloudfront.net,http://localhost:8000'
   method.response.header.Access-Control-Allow-Methods = 'GET,POST,PUT,DELETE,OPTIONS'
   method.response.header.Access-Control-Allow-Headers = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
   ```

3. 値に余分なスペースがないか確認
4. 必要に応じて修正して「保存」

### ステップ6: API Gatewayを再デプロイ

1. 「API アクション」→「APIのデプロイ」
2. ステージ: `prod` を選択
3. 「デプロイ」をクリック

### ステップ7: 動作確認

1. ブラウザのキャッシュをクリア（またはシークレットモードで開く）
2. CloudFrontのURLにアクセス: `https://d37xuhikacb4ca.cloudfront.net`
3. タスクの取得・追加をテスト

## 📋 確認チェックリスト

各メソッドで以下を確認：

- [ ] **メソッドレスポンス**にCORSヘッダーが定義されている
- [ ] **統合レスポンス**にCORSヘッダーの値が設定されている
- [ ] Access-Control-Allow-Originに余分なスペースがない
- [ ] Access-Control-Allow-MethodsにPUTとDELETEが含まれている
- [ ] Access-Control-Allow-Headersが設定されている

## 🔍 テスト方法

ブラウザの開発者ツール（F12）で：

1. 「Network」タブを開く
2. タスクを追加してみる
3. リクエストのレスポンスヘッダーを確認：
   - `access-control-allow-origin` が正しく設定されているか
   - `access-control-allow-methods` にPUTとDELETEが含まれているか

## ⚠️ 注意事項

- 値は必ずシングルクォートで囲む
- カンマの後にスペースを入れない
- メソッドレスポンスと統合レスポンスの両方で設定する必要がある



