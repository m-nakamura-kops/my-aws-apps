"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDB = initDB;
exports.getDBConfig = getDBConfig;
exports.getDB = getDB;
exports.closeDB = closeDB;
const promise_1 = __importDefault(require("mysql2/promise"));
let pool = null;
function initDB(config) {
    if (pool) return pool;
    pool = promise_1.default.createPool({
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
function getDB() {
    if (!pool) initDB(getDBConfig());
    return pool;
}
async function closeDB() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
