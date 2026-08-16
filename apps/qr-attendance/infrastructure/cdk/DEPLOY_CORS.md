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

### 本番フロント（Amplify Hosting）のオリジン

本番フロントのオリジン `https://main.d2s96axh42icx2.amplifyapp.com` は
`api-stack.ts` の既定値 + `cdk.json` の `context.frontendPublicOrigin` として設定済みです。
そのため **追加のフラグなしで `cdk deploy` するだけ** で以下が有効になります。

- API Gateway のプリフライト（OPTIONS）許可オリジンに Amplify を追加
- API Gateway の 4xx/5xx GatewayResponse の `Access-Control-Allow-Origin` を Amplify に
- **全 Lambda 関数**へ `CORS_ALLOW_ORIGIN`（= Amplify オリジン）を自動注入
  （`api-stack.ts` 末尾の `this.node.findAll()` ループ。実レスポンスの CORS ヘッダーに反映）

### 別オリジンに変更/追加する場合

`cdk.json` の `context` を編集:

```json
"frontendPublicOrigin": "https://your-frontend.example.com",
"corsExtraOrigins": ["https://another.example.com"]
```

`frontendPublicOrigin` は Lambda の `CORS_ALLOW_ORIGIN` にも使われます（単一オリジン）。
`corsExtraOrigins` はプリフライトの許可リストにのみ追加されます。

## 3. 動作確認

ブラウザで本番フロント `https://main.d2s96axh42icx2.amplifyapp.com` から登録/ログイン API を実行し、
プリフライト（OPTIONS）と実レスポンスの両方に  
`Access-Control-Allow-Origin: https://main.d2s96axh42icx2.amplifyapp.com` が付くことを確認してください。
