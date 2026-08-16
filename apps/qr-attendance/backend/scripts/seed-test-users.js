/**
 * 結合テスト用 検証データ作成スクリプト（Node.js）
 *
 * 管理者・スタッフ・利用者の3パターンのテストユーザーをDBに作成します。
 * パスワードはすべて「TestPass12」。アプリと同じ SHA-256 でハッシュして保存します。
 *
 * 使い方:
 *   cd apps/qr-attendance/backend
 *   node scripts/seed-test-users.js
 *
 * 事前に backend/.env に DB_HOST, DB_USER, DB_PASSWORD, DB_NAME を設定してください。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const TEST_PASSWORD = 'TestPass12';

const TEST_USERS = [
  {
    email: 'it-admin@example.com',
    name_kanji: '結合テスト管理者',
    name_kana: 'ケツゴウテストカンリシャ',
    tel: '090-0000-0001',
    role_flag: 3,
    remarks: '結合テスト用管理者アカウント',
  },
  {
    email: 'it-staff@example.com',
    name_kanji: '結合テストスタッフ',
    name_kana: 'ケツゴウテストスタッフ',
    tel: '090-0000-0002',
    role_flag: 2,
    remarks: '結合テスト用スタッフアカウント',
  },
  {
    email: 'it-user@example.com',
    name_kanji: '結合テスト利用者',
    name_kana: 'ケツゴウテストリヨウシャ',
    tel: '090-0000-0003',
    role_flag: 1,
    remarks: '結合テスト用利用者アカウント',
  },
  {
    email: 'it-dup@example.com',
    name_kanji: '重複登録テスト用',
    name_kana: 'チョウフクトウロクテストヨウ',
    tel: '090-0000-0004',
    role_flag: 1,
    remarks: '1.2.3 重複登録テスト用・このメールで再度登録して400を確認',
  },
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

  const hashedPassword = hashPassword(TEST_PASSWORD);
  const conn = await mysql.createConnection(config);

  try {
    for (const u of TEST_USERS) {
      const roleName = u.role_flag === 3 ? '管理者' : u.role_flag === 2 ? 'スタッフ' : '利用者';
      const [existing] = await conn.execute('SELECT email FROM users WHERE email = ?', [u.email]);
      if (existing.length > 0) {
        await conn.execute(
          `UPDATE users SET password = ?, name_kanji = ?, name_kana = ?, tel = ?, role_flag = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?`,
          [hashedPassword, u.name_kanji, u.name_kana, u.tel, u.role_flag, u.remarks, u.email]
        );
        console.log(`更新: ${u.email} (${roleName})`);
      } else {
        await conn.execute(
          `INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [u.email, hashedPassword, u.name_kanji, u.name_kana, u.tel, u.role_flag, u.remarks]
        );
        console.log(`作成: ${u.email} (${roleName})`);
      }
    }

    console.log('');
    console.log('--- 結合テスト用 ログイン情報（共通パスワード: ' + TEST_PASSWORD + '）---');
    console.log('  管理者: it-admin@example.com');
    console.log('  スタッフ: it-staff@example.com');
    console.log('  利用者: it-user@example.com');
    console.log('  登録テスト重複用（1.2.3）: it-dup@example.com');
    console.log('');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('エラー:', err.message);
  process.exit(1);
});
