/**
 * 005_add_news_is_published_and_type を実行するスクリプト
 * 使い方: cd apps/qr-attendance/backend && node scripts/run-migration-005.js
 * 事前に backend/.env に DB_HOST, DB_USER, DB_PASSWORD, DB_NAME を設定してください。
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

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

async function main() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'qr_attendance',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };

  const conn = await mysql.createConnection(config);

  const alters = [
    "ALTER TABLE news ADD COLUMN is_published TINYINT NOT NULL DEFAULT 1 COMMENT '1=公開 0=非公開'",
    "ALTER TABLE news ADD COLUMN announcement_type TINYINT NOT NULL DEFAULT 1 COMMENT '1=通常 2=重要（緊急）'",
  ];

  for (const sql of alters) {
    try {
      await conn.execute(sql);
      console.log('OK:', sql.slice(0, 50) + '...');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('SKIP (column exists):', err.message);
      } else {
        throw err;
      }
    }
  }

  await conn.end();
  console.log('Migration 005 done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
