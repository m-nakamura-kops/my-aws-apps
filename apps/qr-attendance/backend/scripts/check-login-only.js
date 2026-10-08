#!/usr/bin/env node
/**
 * 1.1.1 ログインのみ実行（API・DB確認用）
 * 使い方: node scripts/check-login-only.js
 * 事前: API 起動 (npm run dev)、DB に it-admin@example.com が存在すること（必要なら node scripts/seed-test-users.js）
 */
const BASE = process.env.API_BASE || 'http://localhost:3001';
const ADMIN = { email: 'it-admin@example.com', password: 'TestPass12' };

async function main() {
  console.log('POST', BASE + '/v1/users/login', ADMIN);
  const res = await fetch(BASE + '/v1/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {}
  console.log('Status:', res.status);
  console.log('Body:', data || text);
  if (res.status === 200 && data?.token) {
    console.log('OK 1.1.1 ログイン（成功）');
    process.exit(0);
  }
  if (res.status === 503 && data?.message?.includes('Database')) {
    console.error('\n→ DB接続失敗の可能性。MySQL を起動し、.env の DB_HOST/DB_USER/DB_PASSWORD/DB_NAME を確認してください。');
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
