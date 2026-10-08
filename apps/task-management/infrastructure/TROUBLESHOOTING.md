# トラブルシューティングガイド

## 🔍 現在のエラー

- **エラーメッセージ**: "Failed to fetch"
- **発生場所**: スマホ・デスクトップ両方
- **状況**: タスクの取得・追加が失敗

## 🔧 段階的なデバッグ手順

### ステップ1: APIエンドポイントの直接テスト

ブラウザで直接APIエンドポイントにアクセスしてテスト：

```
https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod/tasks
```

**期待される結果**:
- JSONレスポンスが返る（CORSエラーは無視）
- または、CORSエラーが表示される（これは正常）

**確認ポイント**:
- APIエンドポイント自体が動作しているか
- レスポンスが返ってくるか

### ステップ2: プリフライトリクエスト（OPTIONS）のテスト

ブラウザの開発者ツール（F12）で：

1. 「Network」タブを開く
2. タスクを追加してみる
3. 失敗しているリクエストを確認：
   - **OPTIONSリクエスト**が送信されているか
   - OPTIONSリクエストのステータスコードは？
   - OPTIONSリクエストのレスポンスヘッダーにCORSヘッダーが含まれているか

### ステップ3: CORS設定の詳細確認

API Gatewayコンソールで以下を確認：

1. `/tasks` リソース → OPTIONSメソッド
   - 「統合レスポンス」タブ
   - ステータスコード200の統合レスポンス
   - レスポンスパラメータを確認：
     - `method.response.header.Access-Control-Allow-Origin`
     - `method.response.header.Access-Control-Allow-Methods`
     - `method.response.header.Access-Control-Allow-Headers`

2. 「メソッドレスポンス」タブも確認
   - ステータスコード200のメソッドレスポンス
   - レスポンスヘッダーに以下が定義されているか：
     - `Access-Control-Allow-Origin`
     - `Access-Control-Allow-Methods`
     - `Access-Control-Allow-Headers`

### ステップ4: メソッドレスポンスの確認

CORSヘッダーは2箇所で設定する必要があります：

1. **メソッドレスポンス**: レスポンスヘッダーを定義
2. **統合レスポンス**: 実際の値を設定

#### メソッドレスポンスの設定手順

1. OPTIONSメソッドを選択
2. **「メソッドレスポンス」タブ**を選択
3. ステータスコード200を選択
4. 「レスポンスヘッダー」セクションで以下を追加：
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`
   - `Access-Control-Allow-Headers`
5. 「保存」をクリック

### ステップ5: 統合レスポンスの確認

1. **「統合レスポンス」タブ**を選択
2. ステータスコード200を選択
3. 「レスポンスパラメータ」セクションで以下を確認：

   ```
   method.response.header.Access-Control-Allow-Origin = 'https://d37xuhikacb4ca.cloudfront.net,http://localhost:8000'
   method.response.header.Access-Control-Allow-Methods = 'GET,POST,PUT,DELETE,OPTIONS'
   method.response.header.Access-Control-Allow-Headers = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
   ```

4. 値に余分なスペースがないか確認
5. 「保存」をクリック

### ステップ6: すべてのメソッドでCORSヘッダーを設定

GET、POST、PUT、DELETEメソッドにもCORSヘッダーが必要です：

1. 各メソッドを選択
2. 「メソッドレスポンス」タブでCORSヘッダーを定義
3. 「統合レスポンス」タブでCORSヘッダーの値を設定

### ステップ7: API Gatewayを再デプロイ

1. 「API アクション」→「APIのデプロイ」
2. ステージ: `prod` を選択
3. 「デプロイ」をクリック

### ステップ8: ブラウザのキャッシュをクリア

1. ブラウザのキャッシュを完全にクリア
2. または、シークレットモードで開く
3. CloudFrontのURLに再度アクセス

## 🔍 よくある問題

### 問題1: メソッドレスポンスにCORSヘッダーが定義されていない

**症状**: OPTIONSリクエストは成功するが、実際のリクエスト（GET、POST）でCORSエラーが発生

**解決方法**: 各メソッドの「メソッドレスポンス」でCORSヘッダーを定義

### 問題2: 統合レスポンスの値にスペースが含まれている

**症状**: CORSヘッダーが正しく設定されているように見えるが、ブラウザが拒否する

**解決方法**: 値から余分なスペースを削除

### 問題3: OPTIONSメソッドが存在しない

**症状**: プリフライトリクエストが404を返す

**解決方法**: OPTIONSメソッドを作成（統合タイプ: Mock）

## 📝 確認チェックリスト

- [ ] APIエンドポイントが直接アクセスできる
- [ ] OPTIONSメソッドが存在する
- [ ] OPTIONSメソッドのメソッドレスポンスにCORSヘッダーが定義されている
- [ ] OPTIONSメソッドの統合レスポンスにCORSヘッダーの値が設定されている
- [ ] GET、POST、PUT、DELETEメソッドのメソッドレスポンスにCORSヘッダーが定義されている
- [ ] GET、POST、PUT、DELETEメソッドの統合レスポンスにCORSヘッダーの値が設定されている
- [ ] Access-Control-Allow-MethodsにPUTとDELETEが含まれている
- [ ] Access-Control-Allow-Originに余分なスペースがない
- [ ] API Gatewayを再デプロイした
- [ ] ブラウザのキャッシュをクリアした

## 🔗 参考情報

- **API Gateway ID**: `c060m18l73`
- **CloudFront URL**: `https://d37xuhikacb4ca.cloudfront.net`
- **APIエンドポイント**: `https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod`



