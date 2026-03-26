# CORS 修正後のデプロイ手順

## 1. Lambda（`shared/utils/response` の反映）

ルートの `response.js` / `response.d.ts` を全関数の `shared/utils` に一括同期:

```bash
cd apps/qr-attendance/backend
npm run sync:response
```

その後、各 Lambda の `npm run build`（または CDK の `build:lambda`）を実行してください。

## 2. API Gateway（CDK）

```bash
cd apps/qr-attendance/infrastructure/cdk
npx cdk deploy QrAttendanceApiStack-dev
```

（スタック名は環境に合わせて変更）

### 本番など別オリジンを許可する場合

`cdk.json` の `context` に例:

```json
"corsExtraOrigins": [
  "https://your-frontend.example.com"
]
```

Lambda 側も **同じオリジン** を返すよう、該当関数の環境変数を設定:

- `CORS_ALLOW_ORIGIN` = `https://your-frontend.example.com`

（未設定時は `http://localhost:3000` が使われます。）

## 3. 動作確認

ブラウザで `http://localhost:3000` からログイン API を実行し、レスポンスヘッダに  
`Access-Control-Allow-Origin: http://localhost:3000` が付くことを確認してください。
