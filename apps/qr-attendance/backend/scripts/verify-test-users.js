#!/usr/bin/env node
/**
 * 結合テスト用ユーザーが users テーブルに存在し、パスワードハッシュがアプリと一致するか検証する。
 *
 * ログイン Lambda は USER_POOL_ID + COGNITO_CLIENT_ID がある場合は Cognito で認証する。
 * その場合も「ユーザーが存在しない」系の 401 を防ぐため DB 行は必要。
 *
 * 使い方:
 *   cd apps/qr-attendance/backend
 *   node scripts/verify-test-users.js
 *
 * 接続: backend/.env の DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL（任意）
 *
 * 検証するパスワード候補:
 *   - TestPass12（seed-test-users.js と統合テストの標準）
 *   - VERIFY_EXTRA_PASSWORDS 環境変数: カンマ区切りで追加（例: password123）
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const DEFAULT_EMAILS = [
  'it-admin@example.com',
  'it-user@example.com',
  'it-staff@example.com',
];

const PRIMARY_TEST_PASSWORD = 'TestPass12';

/** ドキュメントや過去シードで使われた可能性がある平文（照合のみ・ログに平文は出さない） */
const DEFAULT_EXTRA_PASSWORD_GUESSES = ['password123', 'admin123', 'test123'];

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    }
  });
}

function sha256Hex(plain) {
  return crypto.createHash('sha256').update(String(plain), 'utf8').digest('hex');
}

function classifyStoredPassword(stored) {
  if (stored == null || stored === '') return 'empty';
  const s = String(stored);
  if (s.startsWith('$2a$') || s.startsWith('$2b$') || s.startsWith('$2y$')) return 'bcrypt';
  if (/^[0-9a-f]{64}$/i.test(s)) return 'sha256_hex_64';
  if (s.length < 32) return 'short_plaintext_or_other';
  return 'other';
}

async function main() {
  loadEnv();

  const emails = process.env.VERIFY_EMAILS
    ? process.env.VERIFY_EMAILS.split(',').map((e) => e.trim()).filter(Boolean)
    : DEFAULT_EMAILS;

  const envExtra = (process.env.VERIFY_EXTRA_PASSWORDS || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const passwordCandidates = [
    PRIMARY_TEST_PASSWORD,
    ...DEFAULT_EXTRA_PASSWORD_GUESSES,
    ...envExtra,
  ];
  const uniquePasswords = [...new Set(passwordCandidates)];
  const expectedHashes = {};
  for (const p of uniquePasswords) {
    expectedHashes[p] = sha256Hex(p);
  }

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'qr_attendance',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };

  console.log('--- verify-test-users ---');
  console.log('DB:', config.host, config.database, 'user:', config.user);
  console.log('検証メール:', emails.join(', '));
  console.log('主パスワード（seed と同じ）:', PRIMARY_TEST_PASSWORD);
  console.log('');

  let conn;
  try {
    conn = await mysql.createConnection(config);
  } catch (e) {
    console.error('DB 接続失敗:', e.message);
    console.error('.env に DB_HOST / DB_USER / DB_PASSWORD / DB_NAME を設定し、RDS/VPC から届くネットワークか確認してください。');
    process.exit(1);
  }

  let exitCode = 0;

  try {
    for (const email of emails) {
      const [rows] = await conn.execute(
        'SELECT email, password, role_flag, name_kanji FROM users WHERE email = ?',
        [email]
      );

      if (rows.length === 0) {
        console.log(`[NG] ${email}: 行が存在しません（INSERT が必要）`);
        console.log(`      → node scripts/seed-test-users.js を実行してください。`);
        exitCode = 1;
        continue;
      }

      const row = rows[0];
      const stored = row.password;
      const kind = classifyStoredPassword(stored);

      console.log(`[行] ${email}`);
      console.log(`     role_flag=${row.role_flag} name_kanji=${row.name_kanji || ''}`);
      console.log(`     password 種別: ${kind} (先頭20文字: ${String(stored).slice(0, 20)}...)`);

      if (kind === 'bcrypt') {
        console.log(`[!!] ${email}: DB が bcrypt のようです。ログイン Lambda は SHA-256(hex) と比較するローカルモードのみ一致します。`);
        console.log(`     Cognito 本番では DB の password は参照されず、Cognito のパスワードが使われます。`);
      }

      let match = false;
      let matchedPassword = null;
      for (const p of uniquePasswords) {
        if (stored === expectedHashes[p]) {
          match = true;
          matchedPassword = p;
          break;
        }
      }

      if (match) {
        if (matchedPassword === PRIMARY_TEST_PASSWORD) {
          console.log(`[OK] ${email}: 保存ハッシュ = SHA-256(UTF-8 "${matchedPassword}") と一致（seed 標準）`);
        } else {
          console.log(
            `[!!] ${email}: 保存ハッシュは SHA-256("${matchedPassword}") と一致。seed の TestPass12 ではありません。`
          );
          console.log(
            `     ログインで TestPass12 を使うなら: npm run seed-test-users（DB を TestPass12 に揃える）`
          );
          exitCode = 1;
        }
      } else {
        console.log(`[NG] ${email}: 保存パスワードが次のいずれの SHA-256(hex) とも一致しません:`);
        for (const p of uniquePasswords) {
          console.log(`       "${p}" -> ${expectedHashes[p]}`);
        }
        console.log(`     修正: node scripts/seed-test-users.js（全シードユーザーを TestPass12 のハッシュに更新）`);
        exitCode = 1;
      }

      console.log('');
    }

    console.log('--- Cognito について（Lambda に USER_POOL_ID / COGNITO_CLIENT_ID がある場合）---');
    console.log('401 は「DB に行がない」「Cognito のパスワードが違う」「Cognito にユーザーがいない」でも起きます。');
    console.log('DB の SHA-256 が一致していても、Cognito 側で TestPass12 に合わせるか、ユーザーを招待し直してください。');
    console.log('');
  } finally {
    await conn.end();
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
