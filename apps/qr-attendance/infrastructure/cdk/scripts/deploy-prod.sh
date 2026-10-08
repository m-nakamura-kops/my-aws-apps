#!/usr/bin/env bash
# 本番は main からのみ、RDS スタック（VPC）だけを更新する。
# API スタックと MySQL / NAT は意図的にデプロイしない。
set -euo pipefail

cd "$(dirname "$0")/.."

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "prod deploy は main ブランチでのみ実行できます（現在: ${BRANCH}）" >&2
  exit 1
fi

export CDK_ENV=prod
export CDK_DEFAULT_ACCOUNT="${CDK_DEFAULT_ACCOUNT:-588738585231}"
export CDK_DEFAULT_REGION="${CDK_DEFAULT_REGION:-ap-northeast-1}"
export AWS_DEFAULT_REGION="$CDK_DEFAULT_REGION"

echo "予算 monthly-cost-guard-400usd を確認します"
aws budgets describe-budget \
  --account-id "$CDK_DEFAULT_ACCOUNT" \
  --budget-name monthly-cost-guard-400usd >/dev/null

echo "cdk diff QrAttendanceRdsStack-prod"
DIFF="$(npx cdk diff QrAttendanceRdsStack-prod || true)"
printf '%s\n' "$DIFF"

if printf '%s\n' "$DIFF" | grep -E '\[\+\].*(AWS::RDS::DBInstance|AWS::EC2::NatGateway)'; then
  echo "差分に MySQL または NAT の追加があります。デプロイを中止します。" >&2
  exit 1
fi

npx cdk deploy QrAttendanceRdsStack-prod --require-approval never --no-rollback
