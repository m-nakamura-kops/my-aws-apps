# PUT/DELETEメソッドのCORS修正手順（プロキシ統合）

## 🔍 問題

プロキシ統合を使用している場合、統合レスポンスでCORSヘッダーを設定できません。そのため、メソッドレスポンスのみを設定する必要があります。

Lambda関数は既にCORSヘッダーを返すように設定されているため、メソッドレスポンスでCORSヘッダーを定義するだけで動作します。

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

**注意**: 「統合レスポンス」タブは設定不要です（プロキシ統合のため）

### ステップ2: DELETEメソッドのメソッドレスポンスを設定

1. `/tasks/{taskId}` リソースで **DELETEメソッド**を選択
2. **「メソッドレスポンス」タブ**を選択
3. ステータスコード200を選択
4. **「レスポンスヘッダー」**セクションで以下を追加：
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`
   - `Access-Control-Allow-Headers`
5. 「保存」をクリック

**注意**: 「統合レスポンス」タブは設定不要です（プロキシ統合のため）

### ステップ3: OPTIONSメソッドのメソッドレスポンスを確認

1. `/tasks/{taskId}` リソースで **OPTIONSメソッド**を選択
2. **「メソッドレスポンス」タブ**を選択
3. ステータスコード200を選択
4. **「レスポンスヘッダー」**に以下が定義されているか確認：
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`
   - `Access-Control-Allow-Headers`
5. 定義されていない場合は追加して「保存」

### ステップ4: API Gatewayを再デプロイ

1. 「API アクション」→「APIのデプロイ」
2. ステージ: `prod` を選択
3. 「デプロイ」をクリック

### ステップ5: 動作確認

1. ブラウザのキャッシュを完全にクリア（またはシークレットモードで開く）
2. CloudFrontのURLにアクセス: `https://d37xuhikacb4ca.cloudfront.net`
3. タスクの編集・削除をテスト
4. ブラウザの開発者ツール（F12）で「Network」タブを開き、以下を確認：
   - PUT/DELETEリクエストが正常に動作している
   - CORSエラーが発生していない

## 📝 確認チェックリスト

- [ ] PUTメソッドのメソッドレスポンスにCORSヘッダーが定義されている
- [ ] DELETEメソッドのメソッドレスポンスにCORSヘッダーが定義されている
- [ ] OPTIONSメソッドのメソッドレスポンスにCORSヘッダーが定義されている
- [ ] API Gatewayを再デプロイした
- [ ] ブラウザで動作確認した

## ⚠️ 重要なポイント

- **プロキシ統合の場合、統合レスポンスは設定不要です**
- Lambda関数がCORSヘッダーを返すため、メソッドレスポンスでCORSヘッダーを定義するだけで動作します
- メソッドレスポンスでCORSヘッダーを定義することで、API GatewayがLambda関数から返されたCORSヘッダーをクライアントに渡すことができます

## 🔍 動作の仕組み

1. ブラウザがPUT/DELETEリクエストを送信する前に、OPTIONSリクエスト（プリフライト）を送信
2. OPTIONSリクエストはAPI GatewayのMock統合で処理され、CORSヘッダーを返す
3. ブラウザがCORSチェックを通過すると、実際のPUT/DELETEリクエストを送信
4. Lambda関数がリクエストを処理し、CORSヘッダーを含むレスポンスを返す
5. API Gatewayがメソッドレスポンスで定義されたCORSヘッダーをLambda関数のレスポンスから抽出してクライアントに返す



