#!/usr/bin/env bash
#
# デプロイ後スモーク: API Gateway 本番経路で主要 GET を検証する。
# 依存: aws CLI, curl, jq
#
# 環境変数（任意）:
#   SMOKE_STACK_NAME  … 既定 QrAttendanceApiStack-dev
#   SMOKE_EMAIL       … 既定 it-admin@example.com
#   SMOKE_PASSWORD    … 既定 TestPass12（本番では必ず SMOKE_PASSWORD を注入すること）
#
set -euo pipefail

RED='\033[0;31m'
GRN='\033[0;32m'
RST='\033[0m'

STACK_NAME="${SMOKE_STACK_NAME:-QrAttendanceApiStack-dev}"
EMAIL="${SMOKE_EMAIL:-it-admin@example.com}"
PASSWORD="${SMOKE_PASSWORD:-TestPass12}"

pass() {
  echo -e "${GRN}[PASS]${RST} $1 ($2)"
}

fail() {
  echo -e "${RED}[FAIL]${RST} $1 ($2)" >&2
  exit 1
}

# CloudFormation から API ベース URL を取得（ハードコード禁止）
# 出力キー ApiUrl（末尾スラッシュありのため除去）
if ! API_ENDPOINT_RAW="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text 2>/dev/null)"; then
  fail "describe-stacks" "aws CLI failed for stack $STACK_NAME"
fi

if [[ -z "$API_ENDPOINT_RAW" || "$API_ENDPOINT_RAW" == "None" ]]; then
  fail "ApiUrl output" "missing OutputKey ApiUrl on $STACK_NAME (expected CDK CfnOutput ApiUrl)"
fi

API_BASE="${API_ENDPOINT_RAW%/}"

login_json="$(curl -sS -w "\n%{http_code}" -X POST "${API_BASE}/v1/users/login" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p}')")"

login_http="${login_json##*$'\n'}"
login_body="${login_json%$'\n'*}"

if [[ "$login_http" != "200" ]]; then
  fail "POST /v1/users/login" "HTTP $login_http body=${login_body:0:200}"
fi

TOKEN="$(echo "$login_body" | jq -r '.token // empty')"
if [[ -z "$TOKEN" ]]; then
  fail "POST /v1/users/login" "no .token in JSON response"
fi

check_get() {
  local path="$1"
  local label="$2"
  local tmp
  tmp="$(mktemp)"
  local code
  code="$(curl -sS -o "$tmp" -w "%{http_code}" \
    "${API_BASE}${path}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/json")"
  local body
  body="$(cat "$tmp")"
  rm -f "$tmp"

  # 厳格: 本文にランタイムエラー文字列が紛れ込んでいないか
  local lc_body
  lc_body="$(echo "$body" | tr '[:upper:]' '[:lower:]')"
  if echo "$lc_body" | grep -qE 'importmodulerror|runtime\.importmoduleerror|internal server error'; then
    fail "$label" "HTTP $code + error phrase in body: ${body:0:300}"
  fi

  case "$code" in
    200)
      pass "$label" "200 OK"
      ;;
    *)
      fail "$label" "HTTP $code body=${body:0:400}"
      ;;
  esac
}

check_get "/v1/users/me" "GET /v1/users/me"
check_get "/v1/news" "GET /v1/news"
check_get "/v1/events" "GET /v1/events"
check_get "/v1/users/schedule" "GET /v1/users/schedule"

echo ""
echo -e "${GRN}All smoke checks passed.${RST} API_BASE=${API_BASE}"
