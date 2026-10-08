/**
 * データベース接続管理
 * Amazon RDS Data APIまたは直接接続を使用
 */
import mysql from 'mysql2/promise';
import type { PoolConnection, Pool } from 'mysql2/promise';
export type { Pool, PoolConnection };
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
export declare function initDB(config: DBConfig): mysql.Pool;
/**
 * 環境変数からデータベース設定を取得
 */
export declare function getDBConfig(): DBConfig;
/**
 * データベース接続プールを取得
 */
export declare function getDB(): mysql.Pool;
/**
 * プールから接続を1本取得し、必ず release する
 */
export declare function withConnection<T>(pool: mysql.Pool, fn: (conn: PoolConnection) => Promise<T>): Promise<T>;
/**
 * データベース接続を閉じる
 */
export declare function closeDB(): Promise<void>;
//# sourceMappingURL=connection.d.ts.map