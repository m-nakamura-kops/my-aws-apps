# Infrastructure as Code (AWS CDK)

## 概要

AWS CDKを使用してQRコード打刻システムのインフラストラクチャを定義します。

## セットアップ

```bash
cd infrastructure/cdk
npm install
```

## デプロイ

```bash
# 開発環境
cdk deploy --context env=dev

# 本番環境
cdk deploy --context env=prod
```

## スタック構成

- **DatabaseStack**: RDSインスタンス
- **LambdaStack**: Lambda関数とAPI Gateway
- **CognitoStack**: Cognito User Pool
- **AmplifyStack**: Amplify Hosting設定（オプション）

## 環境変数

`.env`ファイルまたはCDKコンテキストで設定：

```bash
DB_HOST=your-rds-endpoint
DB_NAME=qr_attendance
DB_USER=admin
DB_PASSWORD=your-password
```

## 注意事項

- 本番環境では必ずシークレットマネージャーを使用してください
- VPC設定は必要に応じて調整してください
- セキュリティグループは最小権限の原則に従ってください
