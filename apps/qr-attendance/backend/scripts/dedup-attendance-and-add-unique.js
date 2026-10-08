/**
 * attendance_logs の重複削除と UNIQUE 制約の追加
 * 同一 (event_id, email) で複数行ある場合、log_id が最小の1件を残し他を削除。その後 uk_event_email を追加。
 * 使い方: cd apps/qr-attendance/backend && node scripts/dedup-attendance-and-add-unique.js
 */

const path = require('path');
const fs = require('fs');
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

  // 1) 重複件数確認
  const [dupGroups] = await conn.execute(
    `SELECT event_id, email, COUNT(*) AS cnt FROM attendance_logs GROUP BY event_id, email HAVING cnt > 1`
  );
  const totalDupRows = dupGroups.reduce((s, r) => s + (Number(r.cnt) || 0), 0);
  const extraRows = totalDupRows - dupGroups.length; // 残す1件を除いた削除対象
  console.log('Duplicate (event_id, email) groups:', dupGroups.length);
  console.log('Total duplicate rows to remove (keeping 1 per group):', extraRows);

  if (extraRows > 0) {
    // 2) 同一 (event_id, email) のうち log_id が最小でない行を削除
    const [delResult] = await conn.execute(`
      DELETE al1 FROM attendance_logs al1
      INNER JOIN attendance_logs al2
        ON al1.event_id = al2.event_id AND al1.email = al2.email AND al1.log_id > al2.log_id
    `);
    console.log('Deleted rows:', delResult.affectedRows);
  }

  // 3) UNIQUE 制約がなければ追加
  const [indexRows] = await conn.execute(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_logs' AND INDEX_NAME = 'uk_event_email'`,
    [config.database]
  );
  if (indexRows.length === 0) {
    await conn.execute(`
      ALTER TABLE attendance_logs
      ADD UNIQUE KEY uk_event_email (event_id, email) COMMENT '同一イベント・同一利用者の二重打刻防止'
    `);
    console.log('Added UNIQUE KEY uk_event_email (event_id, email).');
  } else {
    console.log('UNIQUE KEY uk_event_email already exists.');
  }

  await conn.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
