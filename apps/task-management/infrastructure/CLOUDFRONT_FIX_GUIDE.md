# CloudFront 403エラー修正手順

## 📋 現在の状況

- **問題**: CloudFrontから403 Forbiddenエラーが発生
- **原因**: S3ウェブサイトエンドポイントを使用しているが、S3バケットのパブリックアクセスがブロックされている
- **解決方法**: CloudFrontのOriginを通常のS3エンドポイントに変更し、Origin Access Control (OAC) を設定

## 🔧 修正手順

### ステップ1: Origin Access Control (OAC) の作成

1. [CloudFrontコンソール](https://console.aws.amazon.com/cloudfront/)にアクセス
2. 左側のメニューから「Origin access」を選択
3. 「Create control setting」ボタンをクリック
4. 以下の設定を入力：
   - **Name**: `task-management-oac`
   - **Description**: `Task Management App OAC`
   - **Signing behavior**: `Sign requests (recommended)` を選択
   - **Signing protocol**: `SigV4` を選択
   - **Origin type**: `S3` を選択
5. 「Create」ボタンをクリック
6. **OAC ID**をメモしてください（例: `E1W6KJOEWWQ8DA`）

### ステップ2: CloudFrontディストリビューションの編集

1. CloudFrontコンソールで「Distributions」を選択
2. ディストリビューションID `E3UN2UEFZ7ZSRY` をクリック
3. 「Origins」タブを選択
4. 「S3-task-management-frontend」を選択して「Edit」をクリック
5. 以下の設定を変更：

   **Origin domain**:
   - 現在: `task-management-frontend-1765093830.s3-website-ap-northeast-1.amazonaws.com`
   - 変更後: `task-management-frontend-1765093830.s3.ap-northeast-1.amazonaws.com`
     - ⚠️ `s3-website` を `s3` に変更してください

   **Origin access**:
   - 「Origin access control settings (recommended)」を選択
   - 「Control setting」ドロップダウンから、ステップ1で作成した `task-management-oac` を選択
   - 「Copy policy」ボタンをクリック（後で使用します）

   **Name**: `S3-task-management-frontend`（変更不要）

6. 「Save changes」をクリック

### ステップ3: S3バケットポリシーの更新

1. [S3コンソール](https://console.aws.amazon.com/s3/)にアクセス
2. バケット `task-management-frontend-1765093830` を選択
3. 「Permissions」タブを選択
4. 「Bucket policy」セクションで「Edit」をクリック
5. ステップ2でコピーしたポリシーを貼り付け
6. 「Save changes」をクリック

   **ポリシーの例**（ステップ2でコピーしたものを使用）:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowCloudFrontServicePrincipal",
         "Effect": "Allow",
         "Principal": {
           "Service": "cloudfront.amazonaws.com"
         },
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::task-management-frontend-1765093830/*",
         "Condition": {
           "StringEquals": {
             "AWS:SourceArn": "arn:aws:cloudfront::588738585231:distribution/E3UN2UEFZ7ZSRY"
           }
         }
       }
     ]
   }
   ```

### ステップ4: CloudFrontディストリビューションの再デプロイ

1. CloudFrontコンソールに戻る
2. ディストリビューション `E3UN2UEFZ7ZSRY` を選択
3. 「Behaviors」タブを確認（変更不要）
4. 「Error pages」タブを確認（404エラー時にindex.htmlを返す設定があることを確認）
5. 右上の「Deploy」ボタンをクリック
6. 確認ダイアログで「Deploy」をクリック

### ステップ5: デプロイ完了を待つ

- CloudFrontのデプロイには通常 **15-20分** かかります
- 「Status」が `Deployed` になるまで待ってください
- デプロイ中は「In Progress」と表示されます

### ステップ6: 動作確認

デプロイ完了後：

1. CloudFrontのURLにアクセス: `https://d37xuhikacb4ca.cloudfront.net`
2. アプリが正常に表示されることを確認
3. タスクの追加・編集・削除が動作することを確認
4. ブラウザの開発者ツール（F12）でエラーがないか確認

## ⚠️ 重要なポイント

### Origin domain の変更
- ❌ `s3-website-ap-northeast-1.amazonaws.com` （ウェブサイトエンドポイント）
- ✅ `s3.ap-northeast-1.amazonaws.com` （通常のS3エンドポイント）

### なぜこの変更が必要か
- S3ウェブサイトエンドポイントはパブリックアクセスが必要
- 通常のS3エンドポイントはOACを使用してプライベートのままアクセス可能
- セキュリティ上、通常のS3エンドポイント + OAC の方が推奨

## 🔍 トラブルシューティング

### 403エラーが続く場合

1. **S3バケットポリシーを確認**
   - CloudFrontのARNが正しく設定されているか確認
   - ポリシーのJSON形式が正しいか確認

2. **OACの設定を確認**
   - CloudFrontのOriginでOACが正しく選択されているか確認
   - OACのSigning behaviorが「Sign requests」になっているか確認

3. **デプロイ状況を確認**
   - CloudFrontのStatusが「Deployed」になっているか確認
   - デプロイ中は変更が反映されません

### 404エラーが発生する場合

1. **Error pagesの設定を確認**
   - 404エラー時に `/index.html` を返す設定があるか確認
   - Response code が `200` に設定されているか確認

2. **S3バケットのファイルを確認**
   - `index.html` が正しくアップロードされているか確認

## 📝 確認チェックリスト

- [ ] OACを作成した
- [ ] CloudFrontのOrigin domainを `s3.ap-northeast-1.amazonaws.com` に変更した
- [ ] CloudFrontのOrigin access control settingsでOACを選択した
- [ ] S3バケットポリシーを更新した
- [ ] CloudFrontディストリビューションを再デプロイした
- [ ] デプロイ完了を待った（15-20分）
- [ ] CloudFrontのURLでアプリが表示されることを確認した

## 🔗 参考情報

- **CloudFrontディストリビューションID**: `E3UN2UEFZ7ZSRY`
- **CloudFront URL**: `https://d37xuhikacb4ca.cloudfront.net`
- **S3バケット名**: `task-management-frontend-1765093830`
- **APIエンドポイント**: `https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod`

## 📚 関連ドキュメント

- [CloudFront公式ドキュメント](https://docs.aws.amazon.com/cloudfront/)
- [Origin Access Control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)








