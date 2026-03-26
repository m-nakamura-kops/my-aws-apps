#!/usr/bin/env bash
# CloudFormation から ApiUrl / Cognito を取得し frontend/.env.staging.local を生成
# Next.js は .env.local を読むため、ステージング確認時は cp .env.staging.local .env.local
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FE="$ROOT/frontend"
OUT_FILE="$FE/.env.staging.local"

export CDK_ENV="${CDK_ENV:-dev}"
API_STACK="QrAttendanceApiStack-${CDK_ENV}"
COG_STACK="QrAttendanceCognitoStack-${CDK_ENV}"

API_URL="$(aws cloudformation describe-stacks \
  --stack-name "$API_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)"
# 末尾スラッシュを除去（api-client は /v1/... と連結するため）
API_URL="${API_URL%/}"

POOL_ID="$(aws cloudformation describe-stacks \
  --stack-name "$COG_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)"

CLIENT_ID="$(aws cloudformation describe-stacks \
  --stack-name "$COG_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text)"

REGION="${AWS_REGION:-ap-northeast-1}"

if [[ -z "$API_URL" || "$API_URL" == "None" ]]; then
  echo "ERROR: ApiUrl が取得できません。$API_STACK をデプロイ済みか確認してください。"
  exit 1
fi

cat > "$OUT_FILE" << EOF
# 自動生成: scripts/staging/03-sync-frontend-env.sh
# 反映: cp .env.staging.local .env.local && npm run dev
NEXT_PUBLIC_API_URL=${API_URL}
NEXT_PUBLIC_COGNITO_USER_POOL_ID=${POOL_ID}
NEXT_PUBLIC_COGNITO_CLIENT_ID=${CLIENT_ID}
NEXT_PUBLIC_AWS_REGION=${REGION}
NEXT_PUBLIC_APP_NAME=QRコード打刻システム
NEXT_PUBLIC_APP_VERSION=0.1.0-staging
EOF

echo "Wrote $OUT_FILE"
echo "NEXT_PUBLIC_API_URL=$API_URL"
echo "NEXT: cd $FE && cp .env.staging.local .env.local && npm run dev"
