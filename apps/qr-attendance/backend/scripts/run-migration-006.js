/**
 * 006_attendance_logs_add_type_entry_exit を実行するスクリプト
 * 使い方: cd apps/qr-attendance/backend && node scripts/run-migration-006.js
 */

const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const t = line.trim();
    if (t && !t.startsWith('#') && t.indexOf('=') > 0) {
      const k = t.slice(0, t.indexOf('=')).trim();
      const v = t.slice(t.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
      process.env[k] = v;
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

  const run = async (sql, msg) => {
    try {
      await conn.execute(sql);
      console.log('OK:', msg);
    } catch (e) {
      if (e.code === 'ER_CANT_DROP_FIELD_OR_KEY' || e.code === 'ER_DROP_INDEX_MISSING_IN_FOREIGN_KEY' || (e.message && e.message.includes('uk_event_email'))) {
        console.log('SKIP (index not found):', msg);
      } else if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_DUP_KEYNAME') {
        console.log('SKIP (already exists):', msg);
      } else {
        throw e;
      }
    }
  };

  await run('ALTER TABLE attendance_logs DROP INDEX uk_event_email', 'drop uk_event_email');
  try {
    await conn.execute("ALTER TABLE attendance_logs ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'entry' COMMENT 'entry=入室 exit=退出' AFTER event_id");
    console.log('OK: add type column');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('SKIP: type column exists');
    else throw e;
  }
  await conn.execute('ALTER TABLE attendance_logs MODIFY COLUMN in_time DATETIME NULL COMMENT "入室時刻（entry時必須）"');
  console.log('OK: in_time allow null');

  const [rowsWithOut] = await conn.execute('SELECT log_id, email, event_id, out_time, staff_email, created_at, updated_at FROM attendance_logs WHERE type = ? AND out_time IS NOT NULL', ['entry']);
  if (rowsWithOut.length > 0) {
    for (const r of rowsWithOut) {
      await conn.execute(
        'INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)',
        [r.email, r.event_id, 'exit', r.out_time, r.staff_email || r.email, r.created_at, r.updated_at]
      );
    }
    await conn.execute('UPDATE attendance_logs SET out_time = NULL, updated_at = CURRENT_TIMESTAMP WHERE type = ? AND out_time IS NOT NULL', ['entry']);
    console.log('OK: migrated', rowsWithOut.length, 'rows to entry+exit');
  }

  try {
    await conn.execute('ALTER TABLE attendance_logs DROP INDEX uk_event_email_type');
    console.log('OK: drop uk_event_email_type (allow multiple entry/exit)');
  } catch (e) {
    if (e.code === 'ER_CANT_DROP_FIELD_OR_KEY' || e.errno === 1091) {
      console.log('SKIP: uk_event_email_type does not exist');
    } else {
      throw e;
    }
  }

  await conn.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
