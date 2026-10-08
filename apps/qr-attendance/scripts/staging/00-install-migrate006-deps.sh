#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT/infrastructure/cdk/lambda-functions/migrate-006"
npm install
echo "OK: migrate-006 dependencies installed."
