# ゲートウェイレスポンスのCORSヘッダー修正手順（簡易版）

## 🔍 問題

`Access-Control-Allow-Origin`ヘッダーに複数の値が設定されています：
- **現在の値**: `'https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000'`
- **修正後**: `'https://d37xuhikacb4ca.cloudfront.net'`

## 🔧 修正手順

### ステップ1: DEFAULT 4XXを修正

1. 現在開いている「ゲートウェイレスポンスを編集: DEFAULT 4XX」画面で
2. **「レスポンスヘッダー」**セクションを確認
3. **`Access-Control-Allow-Origin`** の値をクリックして編集
4. 現在の値: `'https://d37xuhikacb4ca.cloudfront.net, http://localhost:8000'`
5. **カンマ以降を削除**して、以下のように変更：
   ```
   'https://d37xuhikacb4ca.cloudfront.net'
   ```
6. 「変更を保存」ボタンをクリック

### ステップ2: DEFAULT 5XXを修正

1. 左側メニューで「ゲートウェイのレスポンス」を選択
2. **「DEFAULT 5XX」**をクリック
3. **「レスポンスヘッダー」**セクションで
4. **`Access-Control-Allow-Origin`** の値を編集
5. カンマ以降を削除して `'https://d37xuhikacb4ca.cloudfront.net'` に変更
6. 「変更を保存」ボタンをクリック

### ステップ3: UNAUTHORIZEDを修正

1. **「ゲートウェイのレスポンス」**メニューで
2. **「UNAUTHORIZED」**をクリック
3. **「レスポンスヘッダー」**セクションで
4. **`Access-Control-Allow-Origin`** の値を編集
5. カンマ以降を削除して `'https://d37xuhikacb4ca.cloudfront.net'` に変更
6. 「変更を保存」ボタンをクリック

### ステップ4: API Gatewayを再デプロイ

1. 右上の「API アクション」ボタンをクリック
2. 「APIのデプロイ」を選択
3. **デプロイステージ**: `prod` を選択
4. 「デプロイ」ボタンをクリック

## ⚠️ 重要なポイント

- **`Access-Control-Allow-Origin`** は「レスポンスヘッダー」セクションに表示されています
- 値はシングルクォート（`'`）で囲む必要があります
- カンマ以降の `, http://localhost:8000` を削除してください
- 3つのゲートウェイレスポンス（DEFAULT 4XX、DEFAULT 5XX、UNAUTHORIZED）すべてを修正してください



