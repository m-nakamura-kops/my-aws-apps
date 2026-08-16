# ステージング運用 Runbook（デプロイ・006・フロント URL）

## 1. マイグレーション 006（推奨: VPC 内 Lambda）

現在の RDS は **プライベート・非パブリック** のため、手元 Mac から直接 MySQL に繋がりません。  
**Migrate006Lambda**（API 非公開・`aws lambda invoke` のみ）が Lambda SG 経由で RDS に接続します。

```bash
cd apps/qr-attendance/scripts/staging
chmod +x *.sh
./00-install-migrate006-deps.sh
./01-cdk-deploy-api.sh
./02-invoke-migrate006.sh
```

- `02` のレスポンスで `ok: true` なら 006 + ビュー更新まで完了（Lambda 内で実施）。
- 再実行は idempotent 寄り（既存カラム・インデックスは SKIP）だが、本番前は検証すること。

### 代替: 踏み台 SSH / SSM

- `migrate-006-via-ssh-tunnel.sh` … トンネル手順のメモ
- `migrate-006-via-ssm-tunnel.sh` … SSM ポートフォワード例

一時的な RDS パブリック化は **セキュリティリスクが高い** ため Runbook では推奨しません。

---

## 2. CDK デプロイ再試行（Aborted 対策）

**想定原因**

| 原因 | 対処 |
|------|------|
| Cursor / サンドボックスの **タイムアウト** | **Mac のターミナル**で `01-cdk-deploy-api.sh` を実行 |
| **承認プロンプト**待ち | スクリプトは `--require-approval never` 済み |
| **CDK_DEFAULT_ACCOUNT 未設定** | スクリプトが `aws sts get-caller-identity` で補完 |
| AWS 認証なし | `aws sts get-caller-identity` を先に確認 |

**手動コマンド（同等）**

```bash
export CDK_ENV=dev
export CDK_DEFAULT_REGION=ap-northeast-1
export AWS_REGION=ap-northeast-1
export CDK_DEFAULT_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"

cd apps/qr-attendance/infrastructure/cdk/lambda-functions/migrate-006 && npm install
cd ../../..
npm run build:lambda
npx cdk deploy "QrAttendanceApiStack-${CDK_ENV}" --require-approval never
```

---

## 3. ステージング API URL とフロント設定

```bash
cd apps/qr-attendance/scripts/staging
./03-sync-frontend-env.sh
```

- `frontend/.env.staging.local` が生成されます（`NEXT_PUBLIC_API_URL` は末尾 `/` を除去済み）。
- ローカルでステージング API に向けるには:

```bash
cd apps/qr-attendance/frontend
cp .env.staging.local .env.local
npm run dev
```

ブラウザで **ログイン画面** が表示され、Cognito + API がステージングに向いていれば、ここから **No.9 ST**（負荷・権限）を開始できます。

**ApiUrl のみ確認する場合**

```bash
aws cloudformation describe-stacks \
  --stack-name QrAttendanceApiStack-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

---

## 関連ファイル

- `scripts/staging/README.md`（英語短縮版）
- `docs/ST_PROCEDURE.md`（ST 全体手順）
- `infrastructure/cdk/lib/api-stack.ts` … `Migrate006Lambda` と `Migrate006LambdaName` 出力
