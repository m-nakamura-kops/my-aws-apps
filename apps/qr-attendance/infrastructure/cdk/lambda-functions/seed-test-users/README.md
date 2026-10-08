# SeedTestUsers Lambda

プライベート RDS にはローカルから届かないため、`backend/scripts/seed-test-users.js` と同じ内容を **VPC 内のこの Lambda** で実行する。

```bash
FN=$(aws cloudformation describe-stacks --stack-name QrAttendanceApiStack-dev \
  --query "Stacks[0].Outputs[?OutputKey=='SeedTestUsersLambdaName'].OutputValue" --output text)
aws lambda invoke --function-name "$FN" --cli-binary-format raw-in-base64-out --payload '{}' /tmp/seed-out.json
cat /tmp/seed-out.json | jq .
```

`body` 内の `verification` で `it-admin@example.com` 等の存在と `TestPass12` の SHA-256 一致を確認できる。
