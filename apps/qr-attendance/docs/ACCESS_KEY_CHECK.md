# 既存アクセスキーの確認手順

## 概要

既存のAWSアクセスキーがCDKデプロイに使用できるか確認する手順です。

## ステップ1: 既存アクセスキーの確認

画像から確認できる情報：
- **Access Key ID 1**: `AKIAYSE4N4KH4IRS677D` (108日前作成、cloudformation使用)
- **Access Key ID 2**: `AKIAYSE4N4KHYX3XHYHN` (19日前作成、rekognition使用)
- 両方とも **Active** ステータス
- 両方とも `ap-northeast-1` リージョンで使用済み

## ステップ2: AWS CLIでの認証確認

### 2-1. 現在の認証情報を確認

```bash
aws sts get-caller-identity
```

正しく設定されていれば、以下のような出力が表示されます：

```json
{
    "UserId": "AIDA...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

### 2-2. 認証情報が設定されていない場合

既存のアクセスキーを使用するには、`aws configure`で設定します：

```bash
aws configure
```

以下の情報を入力：
- **AWS Access Key ID**: 既存のアクセスキーID（例: `AKIAYSE4N4KH4IRS677D`）
- **AWS Secret Access Key**: 対応するシークレットアクセスキー（AWSコンソールで確認できないため、保存しているものを使用）
- **Default region name**: `ap-northeast-1`
- **Default output format**: `json`

**注意**: Secret Access KeyはAWSコンソールでは表示されません。保存していない場合は、新しいアクセスキーを作成する必要があります。

## ステップ3: 必要な権限の確認

CDKでRDS、Cognito、Lambdaなどのリソースを作成するには、以下の権限が必要です。

### 3-1. 権限チェックスクリプト

以下のコマンドで、必要な権限があるか確認できます：

```bash
# 必要な権限のリスト
cat > /tmp/check_permissions.sh << 'EOF'
#!/bin/bash

echo "=== AWS権限チェック ==="
echo ""

# CloudFormation権限
echo "1. CloudFormation権限チェック..."
aws cloudformation describe-stacks --max-items 1 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ CloudFormation: OK"
else
    echo "   ✗ CloudFormation: 権限が不足しています"
fi

# EC2権限（VPC作成に必要）
echo "2. EC2権限チェック..."
aws ec2 describe-vpcs --max-items 1 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ EC2: OK"
else
    echo "   ✗ EC2: 権限が不足しています"
fi

# RDS権限
echo "3. RDS権限チェック..."
aws rds describe-db-instances --max-items 1 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ RDS: OK"
else
    echo "   ✗ RDS: 権限が不足しています"
fi

# Lambda権限
echo "4. Lambda権限チェック..."
aws lambda list-functions --max-items 1 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ Lambda: OK"
else
    echo "   ✗ Lambda: 権限が不足しています"
fi

# API Gateway権限
echo "5. API Gateway権限チェック..."
aws apigateway get-rest-apis --limit 1 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ API Gateway: OK"
else
    echo "   ✗ API Gateway: 権限が不足しています"
fi

# Cognito権限
echo "6. Cognito権限チェック..."
aws cognito-idp list-user-pools --max-results 1 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ Cognito: OK"
else
    echo "   ✗ Cognito: 権限が不足しています"
fi

# Secrets Manager権限
echo "7. Secrets Manager権限チェック..."
aws secretsmanager list-secrets --max-results 1 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ Secrets Manager: OK"
else
    echo "   ✗ Secrets Manager: 権限が不足しています"
fi

# IAM権限（ロール作成に必要）
echo "8. IAM権限チェック..."
aws iam list-roles --max-items 1 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ IAM: OK"
else
    echo "   ✗ IAM: 権限が不足しています"
fi

echo ""
echo "=== チェック完了 ==="
EOF

chmod +x /tmp/check_permissions.sh
/tmp/check_permissions.sh
```

### 3-2. 推奨IAMポリシー

CDKデプロイに必要な最小限の権限：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "ec2:*",
        "rds:*",
        "lambda:*",
        "apigateway:*",
        "cognito-idp:*",
        "secretsmanager:*",
        "iam:*",
        "s3:*",
        "logs:*",
        "events:*"
      ],
      "Resource": "*"
    }
  ]
}
```

**注意**: 本番環境では、最小権限の原則に従い、必要な権限のみを付与することを推奨します。

## ステップ4: 権限が不足している場合の対処

### オプション1: IAMポリシーを追加（推奨）

1. AWSコンソールでIAMサービスに移動
2. 「ユーザー」→ 該当するユーザーを選択
3. 「許可を追加」→ 「ポリシーを直接アタッチ」
4. 上記の推奨ポリシーをアタッチ

### オプション2: 管理者権限を一時的に付与（開発環境のみ）

開発環境では、`AdministratorAccess`ポリシーを一時的にアタッチすることも可能です。

**警告**: 本番環境では絶対に使用しないでください。

## ステップ5: CDKブートストラップのテスト

権限が確認できたら、CDKブートストラップを試してみます：

```bash
cd apps/qr-attendance/infrastructure/cdk

# 環境変数の設定
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=ap-northeast-1

# ブートストラップのテスト（実際には実行しない）
cdk bootstrap --dry-run
```

エラーがなければ、実際にブートストラップを実行：

```bash
cdk bootstrap
```

## トラブルシューティング

### エラー: "Access Denied"

権限が不足している可能性があります。上記の権限チェックスクリプトを実行して確認してください。

### エラー: "InvalidAccessKeyId"

アクセスキーIDが間違っているか、無効になっています。AWSコンソールで確認してください。

### エラー: "SignatureDoesNotMatch"

Secret Access Keyが間違っています。正しいSecret Access Keyを入力してください。

## 次のステップ

権限が確認できたら、[FIRST_DEPLOY.md](./FIRST_DEPLOY.md)に従ってRDSスタックのデプロイを開始してください。
