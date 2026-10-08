#!/usr/bin/env bash
set -euo pipefail
export CDK_ENV="${CDK_ENV:-dev}"
STACK="QrAttendanceApiStack-${CDK_ENV}"
OUT="${TMPDIR:-/tmp}/migrate006-response-$$.json"
NAME="$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='Migrate006LambdaName'].OutputValue" \
  --output text)"
if [[ -z "$NAME" || "$NAME" == "None" ]]; then
  echo "ERROR: Migrate006LambdaName not found. Run 01-cdk-deploy-api.sh first."
  exit 1
fi
echo "Invoking Lambda: $NAME"
aws lambda invoke \
  --function-name "$NAME" \
  --cli-binary-format raw-in-base64-out \
  --payload '{}' \
  "$OUT"
echo "Response file: $OUT"
cat "$OUT"
echo ""
