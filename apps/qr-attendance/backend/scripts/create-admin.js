/**
 * 管理者アカウントを1件作成するスクリプト
 * 使い方: node scripts/create-admin.js [email] [password]
 * 例: node scripts/create-admin.js admin@example.com admin123
 * 省略時: admin@example.com / admin123
 *
 * 事前に backend/.env に DB_HOST, DB_USER, DB_PASSWORD, DB_NAME を設定してください。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

// .env を読み込み（backend 直下）
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

const email = process.argv[2] || 'admin@example.com';
const password = process.argv[3] || 'admin123';
const name_kanji = process.argv[4] || '管理者';
const name_kana = process.argv[5] || 'カンリシャ';
const tel = process.argv[6] || '090-1234-5678';

const ROLE_ADMIN = 3;

async function main() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'qr_attendance',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };

  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

  const conn = await mysql.createConnection(config);

  try {
    const [existing] = await conn.execute('SELECT email FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await conn.execute(
        'UPDATE users SET password = ?, name_kanji = ?, name_kana = ?, tel = ?, role_flag = ? WHERE email = ?',
        [hashedPassword, name_kanji, name_kana, tel, ROLE_ADMIN, email]
      );
      console.log('既存ユーザーを管理者に更新しました:', email);
    } else {
      await conn.execute(
        `INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [email, hashedPassword, name_kanji, name_kana, tel, ROLE_ADMIN, '管理者アカウント（スクリプト作成）']
      );
      console.log('管理者アカウントを作成しました:', email);
    }
    console.log('');
    console.log('--- ログイン情報 ---');
    console.log('メールアドレス:', email);
    console.log('パスワード:', password);
    console.log('権限: 管理者 (role_flag=3)');
    console.log('');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('エラー:', err.message);
  process.exit(1);
});
