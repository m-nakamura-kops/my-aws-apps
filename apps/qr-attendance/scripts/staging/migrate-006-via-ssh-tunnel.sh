#!/usr/bin/env bash
# Bastion SSH tunnel example for run-migration-006.js (see script comments inside)
set -euo pipefail
cat << 'END'
Bastion + local port forward:

  ssh -i ~/.ssh/your-key.pem -N -L 13306:RDS_ENDPOINT:3306 ec2-user@BASTION_IP

Then:

  export DB_HOST=127.0.0.1 DB_PORT=13306 DB_SSL=true DB_NAME=qr_attendance DB_USER=admin
  export DB_PASSWORD=(from Secrets Manager)
  cd apps/qr-attendance/backend && node scripts/run-migration-006.js

Apply v_attendance_details SQL from ST_PROCEDURE.md after migration.
END
