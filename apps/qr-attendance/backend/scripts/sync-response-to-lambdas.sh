#!/usr/bin/env bash
# canonical shared/utils/response.{js,d.ts} を全 Lambda の shared/utils にコピー（デプロイ前に実行）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/shared/utils"
for f in response.js response.d.ts; do
  if [[ ! -f "$SRC/$f" ]]; then
    echo "Missing $SRC/$f" >&2
    exit 1
  fi
done
while IFS= read -r -d '' d; do
  cp "$SRC/response.js" "$SRC/response.d.ts" "$d/"
  echo "synced -> $d"
done < <(find "$ROOT/functions" -type d -path '*/shared/utils' -print0)

echo "Done."
