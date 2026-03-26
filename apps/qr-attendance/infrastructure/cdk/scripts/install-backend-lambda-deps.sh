#!/usr/bin/env bash
# すべての API Lambda アセットディレクトリで npm install（package.json がある場合のみ）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
BACKEND="$ROOT/backend/functions"
install_in() {
  local dir="$1"
  if [[ -f "$dir/package.json" ]]; then
    echo "==> npm install: $dir"
    (cd "$dir" && npm install)
  else
    echo "SKIP (no package.json): $dir" >&2
  fi
}

# CDK api-stack.ts の fromAsset と 1:1 に揃える
install_in "$BACKEND/users/login"
install_in "$BACKEND/users/register"
install_in "$BACKEND/admin/events/create"
install_in "$BACKEND/admin/events/list"
install_in "$BACKEND/admin/events/update"
install_in "$BACKEND/admin/events/delete"
install_in "$BACKEND/admin/events/qr"
install_in "$BACKEND/users/attendance"
install_in "$BACKEND/users/attendance/history"
install_in "$BACKEND/users/events/register"
install_in "$BACKEND/users/events/unregister"
install_in "$BACKEND/users/registrations"
install_in "$BACKEND/admin/events/participants"
install_in "$BACKEND/admin/events/attendance-report"
install_in "$BACKEND/admin/students/import"
install_in "$BACKEND/news/list"
install_in "$BACKEND/events/list"
install_in "$BACKEND/attendance/manual"
install_in "$BACKEND/students/search"
install_in "$BACKEND/users/me"
install_in "$BACKEND/users/me-qr"
install_in "$BACKEND/users/schedule"
install_in "$BACKEND/admin/registrations/list"
install_in "$BACKEND/admin/students/list"
install_in "$BACKEND/admin/students/create"
install_in "$BACKEND/admin/students/update"
install_in "$BACKEND/admin/students/delete"
install_in "$BACKEND/admin/staffs/list"
install_in "$BACKEND/admin/staffs/invite"
install_in "$BACKEND/admin/staffs/update"
install_in "$BACKEND/admin/staffs/delete"
install_in "$BACKEND/admin/news/list"
install_in "$BACKEND/admin/news/create"
install_in "$BACKEND/admin/news/update"
install_in "$BACKEND/admin/news/delete"
install_in "$BACKEND/admin/reports/events/csv"
install_in "$BACKEND/admin/users/list"
install_in "$BACKEND/admin/users/update"

echo "Done install-backend-lambda-deps.sh"
