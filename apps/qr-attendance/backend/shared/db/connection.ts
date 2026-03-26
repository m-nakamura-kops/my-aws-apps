/**
 * データベース接続管理
 * Amazon RDS Data APIまたは直接接続を使用
 */

import mysql from 'mysql2/promise';
import type { Pool, PoolConnection } from 'mysql2/promise';

/** Lambda から mysql2 の型を1経路に揃える（ネストした node_modules で Pool 型が二重化されるのを防ぐ） */
export type { Pool, PoolConnection };

let pool: mysql.Pool | null = null;

/**
 * プールから接続を1本取得し、必ず release する（全 Lambda 共通・リーク防止）
 */
export async function withConnection<T>(pool: Pool, fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}

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

  // Lambda 1 実行あたりの同時接続を抑え、RDS の max_connections を枯渇させない
  const rawLimit = parseInt(process.env.CONNECTION_LIMIT || '5', 10);
  const connectionLimit = Number.isNaN(rawLimit)
    ? 5
    : Math.min(Math.max(1, rawLimit), 5);

  const poolConfig = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    idleTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  };

  pool = mysql.createPool(poolConfig);

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
