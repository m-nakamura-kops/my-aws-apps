/**
 * 管理者・スタッフアカウントのパスワードを強制的にリセットするスクリプト
 * 使い方: cd apps/qr-attendance/backend && node scripts/reset-admin-password.js
 * 事前に backend/.env に DB_HOST, DB_USER, DB_PASSWORD, DB_NAME を設定してください。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const NEW_PASSWORD = 'password123';

const EMAILS_TO_RESET = [
  'admin@example.com',
  'it-admin@example.com',
  'it-staff@example.com',
  'it-user@example.com',
];

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
        process.env[key] = value;
      }
    }
  });
}

loadEnv();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'qr_attendance',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };

  const hashed = hashPassword(NEW_PASSWORD);
  const conn = await mysql.createConnection(config);

  console.log('Resetting password to "%s" (SHA-256 hash) for:', NEW_PASSWORD);
  for (const email of EMAILS_TO_RESET) {
    const [result] = await conn.execute(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?',
      [hashed, email]
    );
    if (result.affectedRows > 0) {
      console.log('  OK:', email);
    } else {
      const [exists] = await conn.execute('SELECT email FROM users WHERE email = ?', [email]);
      console.log(exists.length ? '  (no change)' : '  SKIP (not found):', email);
    }
  }

  await conn.end();
  console.log('\nDone. You can now log in with email and password "%s".', NEW_PASSWORD);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
