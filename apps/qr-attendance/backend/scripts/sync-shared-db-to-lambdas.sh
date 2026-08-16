#!/usr/bin/env bash
# canonical shared/db/connection.{js,d.ts} を全 Lambda の shared/db にコピー（デプロイ前に実行）
# 各 Lambda が個別コピーを持つため、JST セッション TZ 等の設定が一部関数だけ古いまま残るのを防ぐ。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/shared/db"
for f in connection.js connection.d.ts; do
  if [[ ! -f "$SRC/$f" ]]; then
    echo "Missing $SRC/$f" >&2
    exit 1
  fi
done
while IFS= read -r -d '' d; do
  cp "$SRC/connection.js" "$SRC/connection.d.ts" "$d/"
  echo "synced -> $d"
done < <(find "$ROOT/functions" -type d -path '*/shared/db' -print0)

echo "Done."
