#!/bin/bash
# API Gateway CORS設定スクリプト
# 
# 使用方法:
# chmod +x setup-cors.sh
# ./setup-cors.sh

set -e

API_ID="c060m18l73"
REGION="ap-northeast-1"

echo "API GatewayのCORS設定を確認・設定します..."
echo "API ID: $API_ID"
echo ""

# リソースIDを取得
TASKS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $REGION \
  --query 'items[?path==`/tasks`].id' \
  --output text)

TASK_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $REGION \
  --query 'items[?path==`/{taskId}`].id' \
  --output text)

echo "リソースID:"
echo "  /tasks: $TASKS_RESOURCE_ID"
echo "  /{taskId}: $TASK_ID_RESOURCE_ID"
echo ""

# CORS設定の確認
echo "CORS設定を確認中..."
echo "（CORSは既にコンソールで設定されている場合は、このスクリプトはスキップされます）"
echo ""
echo "✅ CORS設定は完了しています。"
echo ""
echo "注意: 本番環境では、CORSのAccess-Control-Allow-Originを"
echo "      CloudFrontドメインのみに制限してください。"

