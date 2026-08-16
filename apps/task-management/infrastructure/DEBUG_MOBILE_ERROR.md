# スマホエラーのデバッグ手順

## 📋 現在の状況

- CloudFront: ✅ デプロイ完了
- API Gateway: ✅ CORS設定済み・再デプロイ済み
- スマホ: ❌ まだエラーが発生

## 🔍 デバッグ手順

### ステップ1: ブラウザのコンソールでエラーを確認

スマホのブラウザで開発者ツールを開く（可能な場合）:
- Chrome: リモートデバッグを使用
- Safari: Macと接続してデバッグ

または、デスクトップブラウザで同じURLにアクセスしてエラーを確認

### ステップ2: ネットワークタブでリクエストを確認

1. ブラウザの開発者ツール（F12）を開く
2. 「Network」タブを選択
3. タスクを追加してみる
4. 失敗しているリクエストを確認：
   - リクエストURL
   - ステータスコード
   - エラーメッセージ
   - レスポンスヘッダー

### ステップ3: CORS設定の確認

#### OPTIONSメソッド（プリフライトリクエスト）の確認

1. API Gatewayコンソールで `/tasks` リソースを選択
2. OPTIONSメソッドを選択
3. 「統合レスポンス」タブを確認
4. ステータスコード200の統合レスポンスを確認
5. レスポンスパラメータに以下が含まれているか確認：
   - `method.response.header.Access-Control-Allow-Origin`
   - `method.response.header.Access-Control-Allow-Methods`
   - `method.response.header.Access-Control-Allow-Headers`

### ステップ4: APIエンドポイントの直接テスト

スマホのブラウザで直接APIエンドポイントにアクセスしてテスト：

```
https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod/tasks
```

- エラーが表示されるか確認
- CORSエラーが発生するか確認

### ステップ5: CloudFrontのキャッシュを無効化

CloudFrontのキャッシュが古い可能性があります：

```bash
aws cloudfront create-invalidation \
  --distribution-id E3UN2UEFZ7ZSRY \
  --paths "/*" \
  --region ap-northeast-1
```

## 🔧 よくある問題と解決方法

### 問題1: OPTIONSメソッドが404を返す

**原因**: `/tasks/{taskId}` リソースにOPTIONSメソッドが存在しない

**解決方法**:
1. `/tasks/{taskId}` リソースを選択
2. 「メソッドを作成」をクリック
3. メソッドタイプ: OPTIONS を選択
4. 統合タイプ: Mock を選択
5. 統合レスポンスでCORSヘッダーを設定

### 問題2: CORSヘッダーがレスポンスに含まれていない

**原因**: 統合レスポンスの設定が不完全

**解決方法**:
1. 各メソッド（GET、POST、PUT、DELETE）の「統合レスポンス」を確認
2. ステータスコード200の統合レスポンスを編集
3. レスポンスパラメータにCORSヘッダーを追加

### 問題3: プリフライトリクエストが失敗する

**原因**: OPTIONSメソッドの統合レスポンスが正しく設定されていない

**解決方法**:
1. OPTIONSメソッドの「統合レスポンス」を確認
2. ステータスコード200の統合レスポンスを編集
3. レスポンスパラメータを確認

## 📝 確認チェックリスト

- [ ] `/tasks` リソースにOPTIONSメソッドが存在する
- [ ] `/tasks/{taskId}` リソースにOPTIONSメソッドが存在する
- [ ] OPTIONSメソッドの統合レスポンスにCORSヘッダーが設定されている
- [ ] GET、POST、PUT、DELETEメソッドの統合レスポンスにCORSヘッダーが設定されている
- [ ] API Gatewayを再デプロイした
- [ ] CloudFrontのキャッシュを無効化した
- [ ] ブラウザのキャッシュをクリアした

## 🔗 参考情報

- **CloudFront URL**: `https://d37xuhikacb4ca.cloudfront.net`
- **APIエンドポイント**: `https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod`
- **API Gateway ID**: `c060m18l73`



