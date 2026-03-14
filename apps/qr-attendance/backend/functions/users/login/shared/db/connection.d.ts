/**
 * データベース接続管理
 * Amazon RDS Data APIまたは直接接続を使用
 */
import mysql from 'mysql2/promise';
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
 * データベース接続を閉じる
 */
export declare function closeDB(): Promise<void>;
//# sourceMappingURL=connection.d.ts.map