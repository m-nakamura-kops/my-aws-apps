# Staging deploy and migration scripts

日本語の手順・背景は **`docs/STAGING_RUNBOOK.md`** を参照。

RDS is private. Use **Migrate006Lambda** (invoke only, no API) after CDK deploy.

Run in order:

1. `./00-install-migrate006-deps.sh`
2. `./01-cdk-deploy-api.sh` — use **Mac Terminal** if Cursor times out (Aborted)
3. `./02-invoke-migrate006.sh`
4. `./03-sync-frontend-env.sh`

Then: `cd ../frontend && cp .env.staging.local .env.local && npm run dev`

Bastion alternatives: `migrate-006-via-ssh-tunnel.sh`, `migrate-006-via-ssm-tunnel.sh`

Env: `CDK_ENV=dev`, `CDK_DEFAULT_REGION=ap-northeast-1`, `CDK_DEFAULT_ACCOUNT` from STS if unset.
