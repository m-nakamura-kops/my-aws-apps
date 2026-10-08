# Database Migration Lambda Function

## 概要

RDSにデータベーススキーマを適用するLambda関数です。

## セットアップ

`schema.sql` は **`database/schema.sql` のコピー**です。CDK の `npm run build:lambda:migrate` が `npm run sync-schema` で上書きコピーしてから `npm install` します。

```bash
cd lambda-functions/migrate
npm run sync-schema
npm install
```

Lambda 実行時は `index.js` が `schema.sql` を読み、すべての `CREATE TABLE` を `CREATE TABLE IF NOT EXISTS` に変換してから流します（`CREATE OR REPLACE VIEW` はそのまま）。

## 使用方法

API Gateway 経由：

```bash
curl -X POST https://[API_URL]/migrate
```

VPC 内 Lambda として **AWS CLI で直接 invoke**（SeedTestUsersLambda と同様）:

```bash
FN=$(aws cloudformation describe-stacks --stack-name QrAttendanceApiStack-dev \
  --query "Stacks[0].Outputs[?OutputKey=='MigrateLambdaName'].OutputValue" --output text)
aws lambda invoke --function-name "$FN" --cli-binary-format raw-in-base64-out --payload '{}' /tmp/migrate-out.json
cat /tmp/migrate-out.json | jq .
```

`MigrateLambdaName` は CDK スタック出力に含まれます。

## 注意事項

- この関数は開発環境でのみ使用してください
- 本番環境では、適切な認証を追加してください
- スキーマは`CREATE TABLE IF NOT EXISTS`を使用しているため、既存のテーブルには影響しません
