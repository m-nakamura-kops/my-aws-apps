#!/usr/bin/env node
/**
 * 9.1.2 / 9.1.3 の 500 原因確認用: admin/news create ハンドラを直接実行
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');

const handlerPath = path.join(__dirname, '../functions/admin/news/create/index.js');
const handler = require(handlerPath).handler;

async function run() {
  const adminToken = 'Bearer ' + Buffer.from(JSON.stringify({ email: 'it-admin@example.com' })).toString('base64');
  const userToken = 'Bearer ' + Buffer.from(JSON.stringify({ email: 'it-user@example.com' })).toString('base64');

  const eventAdmin = {
    httpMethod: 'POST',
    path: '/v1/admin/news',
    pathParameters: {},
    headers: { Authorization: adminToken },
    body: JSON.stringify({
      title: 'Test',
      content: 'Body',
      published_at: new Date().toISOString(),
    }),
  };

  const eventUser = {
    ...eventAdmin,
    headers: { Authorization: userToken },
  };

  console.log('--- POST with admin token ---');
  try {
    const res = await handler(eventAdmin);
    console.log('Status:', res.statusCode);
    console.log('Body:', res.body?.substring?.(0, 500));
  } catch (e) {
    console.error('Throw:', e.message);
    console.error(e.stack);
  }

  console.log('\n--- POST with user token (expect 403) ---');
  try {
    const res = await handler(eventUser);
    console.log('Status:', res.statusCode);
    console.log('Body:', res.body?.substring?.(0, 500));
  } catch (e) {
    console.error('Throw:', e.message);
    console.error(e.stack);
  }
}

run();
