#!/bin/bash
# Lambda関数デプロイスクリプト
# 
# 使用方法:
# chmod +x deploy-lambda.sh
# ./deploy-lambda.sh

set -e

FUNCTION_NAME="task-management-api"
REGION="ap-northeast-1"
TABLE_NAME="Tasks"
ROLE_NAME="task-management-lambda-role"

echo "Lambda関数をデプロイします..."
echo "関数名: $FUNCTION_NAME"
echo "リージョン: $REGION"
echo "テーブル名: $TABLE_NAME"
echo ""

# Lambda関数のディレクトリに移動
cd "$(dirname "$0")/../lambda"

# 依存関係のインストール
echo "依存関係をインストール中..."
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "node_modulesが既に存在します。スキップします。"
fi

# ZIPファイルの作成
echo ""
echo "ZIPファイルを作成中..."
zip -r function.zip . -x "*.git*" "*.zip" "*.DS_Store" > /dev/null 2>&1

# Lambda関数が既に存在するか確認
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null; then
    echo ""
    echo "Lambda関数が既に存在します。更新します..."
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file fileb://function.zip \
        --region "$REGION" \
        --no-cli-pager
    
    echo ""
    echo "環境変数を更新中..."
    aws lambda update-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --environment "Variables={TASKS_TABLE_NAME=$TABLE_NAME,AWS_REGION=$REGION}" \
        --region "$REGION" \
        --no-cli-pager
    
    echo ""
    echo "✅ Lambda関数が更新されました！"
else
    echo ""
    echo "⚠️  Lambda関数が存在しません。"
    echo "まず、IAMロールを作成する必要があります。"
    echo ""
    read -p "IAMロールを作成しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "IAMロールを作成中..."
        
        # 信頼ポリシー
        cat > /tmp/trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
        
        # ロールを作成
        ROLE_ARN=$(aws iam create-role \
            --role-name "$ROLE_NAME" \
            --assume-role-policy-document file:///tmp/trust-policy.json \
            --query 'Role.Arn' \
            --output text \
            --no-cli-pager 2>/dev/null || \
            aws iam get-role \
            --role-name "$ROLE_NAME" \
            --query 'Role.Arn' \
            --output text \
            --no-cli-pager)
        
        echo "IAMロールARN: $ROLE_ARN"
        
        # 基本実行ロールポリシーをアタッチ
        echo "基本実行ロールポリシーをアタッチ中..."
        aws iam attach-role-policy \
            --role-name "$ROLE_NAME" \
            --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
            --no-cli-pager
        
        # DynamoDBアクセスポリシーを作成
        echo "DynamoDBアクセスポリシーを作成中..."
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --no-cli-pager)
        
        cat > /tmp/dynamodb-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:$REGION:$ACCOUNT_ID:table/$TABLE_NAME"
    }
  ]
}
EOF
        
        POLICY_ARN=$(aws iam create-policy \
            --policy-name "${ROLE_NAME}-dynamodb-policy" \
            --policy-document file:///tmp/dynamodb-policy.json \
            --query 'Policy.Arn' \
            --output text \
            --no-cli-pager 2>/dev/null || \
            aws iam list-policies \
            --query "Policies[?PolicyName=='${ROLE_NAME}-dynamodb-policy'].Arn" \
            --output text \
            --no-cli-pager | head -n 1)
        
        if [ -n "$POLICY_ARN" ] && [ "$POLICY_ARN" != "None" ]; then
            aws iam attach-role-policy \
                --role-name "$ROLE_NAME" \
                --policy-arn "$POLICY_ARN" \
                --no-cli-pager
        fi
        
        echo "IAMロールの設定が完了しました。数秒待ってからLambda関数を作成します..."
        sleep 5
        
        # Lambda関数を作成
        echo ""
        echo "Lambda関数を作成中..."
        aws lambda create-function \
            --function-name "$FUNCTION_NAME" \
            --runtime nodejs18.x \
            --role "$ROLE_ARN" \
            --handler index.handler \
            --zip-file fileb://function.zip \
            --timeout 30 \
            --memory-size 256 \
            --environment "Variables={TASKS_TABLE_NAME=$TABLE_NAME,AWS_REGION=$REGION}" \
            --region "$REGION" \
            --tags Project=TaskApp,Env=Dev,Owner=Nakamura \
            --no-cli-pager
        
        echo ""
        echo "✅ Lambda関数が作成されました！"
    else
        echo "処理をキャンセルしました。"
        exit 1
    fi
fi

# クリーンアップ
rm -f function.zip
rm -f /tmp/trust-policy.json /tmp/dynamodb-policy.json 2>/dev/null || true

echo ""
echo "Lambda関数の情報:"
aws lambda get-function \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --query 'Configuration.[FunctionName,Runtime,Handler,Timeout,MemorySize,LastModified]' \
    --output table \
    --no-cli-pager

echo ""
echo "✅ デプロイが完了しました！"
echo ""
echo "次のステップ:"
echo "1. API Gatewayを設定してください"
echo "2. フロントエンドのAPIエンドポイントを更新してください"

