# Migrate006 Lambda

- Runs migration 006 and recreates `v_attendance_details` inside VPC.
- Not exposed on API Gateway. Invoke only: `../../scripts/staging/02-invoke-migrate006.sh`
- Before `cdk deploy`, run `npm install` in this directory (see `scripts/staging/00-install-migrate006-deps.sh`).
