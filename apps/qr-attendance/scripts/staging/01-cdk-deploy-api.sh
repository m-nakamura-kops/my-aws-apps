#!/usr/bin/env bash
# Lambda ビルド + QrAttendanceApiStack のデプロイ（承認なし）
# 使い方: Mac のターミナルで実行推奨（長時間・Cursor では Aborted になりやすい）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CDK_DIR="$ROOT/infrastructure/cdk"
export CDK_ENV="${CDK_ENV:-dev}"
export CDK_DEFAULT_REGION="${CDK_DEFAULT_REGION:-${AWS_REGION:-ap-northeast-1}}"
export AWS_REGION="${AWS_REGION:-$CDK_DEFAULT_REGION}"

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: AWS CLI が認証されていません。aws configure または SSO を設定してください。"
  exit 1
fi

if [[ -n "${CDK_DEFAULT_ACCOUNT:-}" ]]; then
  export CDK_DEFAULT_ACCOUNT
elif [[ -n "${AWS_ACCOUNT_ID:-}" ]]; then
  export CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID"
else
  CDK_DEFAULT_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
  export CDK_DEFAULT_ACCOUNT
  echo "Using CDK_DEFAULT_ACCOUNT=$CDK_DEFAULT_ACCOUNT"
fi

echo "==> migrate-006 Lambda: npm install"
"$ROOT/scripts/staging/00-install-migrate006-deps.sh"

echo "==> build:lambda"
cd "$CDK_DIR"
npm run build:lambda

echo "==> cdk deploy QrAttendanceApiStack-${CDK_ENV}"
# --require-approval never: 承認待ちで止まらない
# 失敗時は同じコマンドをターミナルで再実行
npx cdk deploy "QrAttendanceApiStack-${CDK_ENV}" \
  --require-approval never

echo "OK: API stack deployed."
