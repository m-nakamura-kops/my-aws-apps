"use strict";
/**
 * データベース接続管理
 * Amazon RDS Data APIまたは直接接続を使用
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withConnection = withConnection;
exports.initDB = initDB;
exports.getDBConfig = getDBConfig;
exports.getDB = getDB;
exports.closeDB = closeDB;
const promise_1 = __importDefault(require("mysql2/promise"));
let pool = null;
/**
 * プールから接続を1本取得し、必ず release する（全 Lambda 共通・リーク防止）
 */
async function withConnection(pool, fn) {
    const conn = await pool.getConnection();
    try {
        return await fn(conn);
    }
    finally {
        conn.release();
    }
}
/**
 * データベース接続プールの初期化
 */
function initDB(config) {
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
    pool = promise_1.default.createPool(poolConfig);
    return pool;
}
/**
 * 環境変数からデータベース設定を取得
 */
function getDBConfig() {
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
function getDB() {
    if (!pool) {
        initDB(getDBConfig());
    }
    return pool;
}
/**
 * データベース接続を閉じる
 */
async function closeDB() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
