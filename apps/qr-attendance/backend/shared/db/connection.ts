/**
 * データベース接続管理
 * Amazon RDS Data APIまたは直接接続を使用
 */

import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export interface DBConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
}

/**
 * データベース接続プールの初期化
 */
export function initDB(config: DBConfig): mysql.Pool {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  });

  return pool;
}

/**
 * 環境変数からデータベース設定を取得
 */
export function getDBConfig(): DBConfig {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'qr_attendance',
    ssl: process.env.DB_SSL === 'true',
  };
}

/**
 * データベース接続プールを取得
 */
export function getDB(): mysql.Pool {
  if (!pool) {
    initDB(getDBConfig());
  }
  return pool!;
}

/**
 * データベース接続を閉じる
 */
export async function closeDB(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
