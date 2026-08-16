#!/usr/bin/env bash
# SSM Session Manager で VPC 内ホスト経由のポートフォワード例
# 事前: EC2 に SSM エージェント + AmazonSSMManagedInstanceCore、RDS SG が当該 EC2 から 3306 を許可
#
# INSTANCE_ID: ssm で接続する EC2
# RDS_ENDPOINT: RDS のホスト名
#
set -euo pipefail
: "${INSTANCE_ID:?Set INSTANCE_ID (EC2 instance id)}"
: "${RDS_ENDPOINT:?Set RDS_ENDPOINT}"

echo "Run (keep terminal open):"
echo "aws ssm start-session \\"
echo "  --target $INSTANCE_ID \\"
echo "  --document-name AWS-StartPortForwardingSessionToRemoteHost \\"
echo "  --parameters '{\"host\":[\"$RDS_ENDPOINT\"],\"portNumber\":[\"3306\"],\"localPortNumber\":[\"13306\"]}'"
echo ""
echo "Then in another terminal:"
echo "  export DB_HOST=127.0.0.1 DB_PORT=13306 DB_SSL=true DB_USER=admin DB_NAME=qr_attendance"
echo "  export DB_PASSWORD=\$(aws secretsmanager get-secret-value --secret-id <DbSecretArn> --query SecretString --output text | jq -r .password)"
echo "  cd apps/qr-attendance/backend && node scripts/run-migration-006.js"
