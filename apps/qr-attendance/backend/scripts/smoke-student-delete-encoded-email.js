#!/usr/bin/env node
/**
 * スモーク: メールに + を含む生徒を作成し、encodeURIComponent 付き DELETE で物理削除できること
 *
 * 事前: ローカル API (npm run dev) または API_BASE を実環境に向ける
 *   cd apps/qr-attendance/backend && node scripts/smoke-student-delete-encoded-email.js
 */

const BASE = process.env.API_BASE || 'http://localhost:3001';
const ADMIN = { email: 'it-admin@example.com', password: 'TestPass12' };

async function request(method, path, body = null, token = null) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body != null) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { status: res.status, data, text };
}

async function login(email, password) {
  const { status, data } = await request('POST', '/v1/users/login', { email, password });
  if (status !== 200 || !data?.token) throw new Error(`Login failed: ${status}`);
  return data.token;
}

async function main() {
  console.log('=== smoke: student DELETE with + in email (encoded path) ===');
  console.log('API_BASE=', BASE);

  const adminToken = await login(ADMIN.email, ADMIN.password);
  const plusEmail = `it+del-${Date.now()}@example.com`;

  const create = await request(
    'POST',
    '/v1/admin/students',
    {
      email: plusEmail,
      name_kanji: 'プラステスト',
      name_kana: 'プラステスト',
      tel: '090-0000-0099',
    },
    adminToken
  );
  if (create.status !== 201) {
    console.error('NG: create expected 201, got', create.status, create.text);
    process.exit(1);
  }
  console.log('OK: created', plusEmail);

  const delPath = `/v1/admin/students/${encodeURIComponent(plusEmail)}`;
  const del = await request('DELETE', delPath, null, adminToken);
  if (del.status !== 200) {
    console.error('NG: DELETE expected 200, got', del.status, del.text);
    process.exit(1);
  }
  console.log('OK: DELETE', delPath);

  const delAgain = await request('DELETE', delPath, null, adminToken);
  if (delAgain.status !== 404) {
    console.error('NG: second DELETE expected 404, got', delAgain.status, delAgain.text);
    process.exit(1);
  }
  console.log('OK: idempotent check (404 on second delete)');

  console.log('\nAll checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
