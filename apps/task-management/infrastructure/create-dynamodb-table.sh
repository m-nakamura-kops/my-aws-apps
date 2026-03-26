#!/bin/bash
# DynamoDBテーブル作成スクリプト
# 
# 使用方法:
# chmod +x create-dynamodb-table.sh
# ./create-dynamodb-table.sh

set -e

TABLE_NAME="Tasks"
REGION="ap-northeast-1"
OWNER_NAME="${1:-Nakamura}"  # 第1引数で所有者名を指定（デフォルト: Nakamura）

echo "DynamoDBテーブルを作成します..."
echo "テーブル名: $TABLE_NAME"
echo "リージョン: $REGION"
echo "所有者: $OWNER_NAME"
echo ""

# テーブルが既に存在するか確認
if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" 2>/dev/null; then
    echo "⚠️  テーブル '$TABLE_NAME' は既に存在します。"
    read -p "削除して再作成しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "テーブルを削除中..."
        aws dynamodb delete-table \
            --table-name "$TABLE_NAME" \
            --region "$REGION" \
            --no-cli-pager
        
        echo "テーブルが削除されるまで待機中..."
        aws dynamodb wait table-not-exists \
            --table-name "$TABLE_NAME" \
            --region "$REGION"
        
        echo "✅ テーブルが削除されました。"
    else
        echo "処理をキャンセルしました。"
        exit 0
    fi
fi

# テーブルを作成
echo "テーブルを作成中..."
aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=taskId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=taskId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --tags \
        Key=Project,Value=TaskApp \
        Key=Env,Value=Dev \
        Key=Owner,Value="$OWNER_NAME" \
    --no-cli-pager

echo ""
echo "テーブルが作成されるまで待機中..."
aws dynamodb wait table-exists \
    --table-name "$TABLE_NAME" \
    --region "$REGION"

echo ""
echo "✅ テーブル '$TABLE_NAME' が正常に作成されました！"
echo ""
echo "テーブル情報を確認:"
aws dynamodb describe-table \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    --query 'Table.[TableName,TableStatus,BillingModeSummary.BillingMode]' \
    --output table \
    --no-cli-pager

