"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockEnd = jest.fn().mockResolvedValue(undefined);
const mockCreatePool = jest.fn().mockImplementation(() => ({ end: mockEnd }));
jest.mock('mysql2/promise', () => ({
    createPool: (...args) => mockCreatePool(...args),
}));
const connection_1 = require("../connection");
describe('db/connection', () => {
    const originalEnv = process.env;
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
    });
    afterAll(() => {
        process.env = originalEnv;
    });
    describe('getDBConfig', () => {
        it('returns defaults when env is empty', () => {
            delete process.env.DB_HOST;
            delete process.env.DB_PORT;
            delete process.env.DB_USER;
            delete process.env.DB_PASSWORD;
            delete process.env.DB_NAME;
            delete process.env.DB_SSL;
            const config = (0, connection_1.getDBConfig)();
            expect(config).toEqual({
                host: 'localhost',
                port: 3306,
                user: 'root',
                password: '',
                database: 'qr_attendance',
                ssl: false,
            });
        });
        it('reads from process.env', () => {
            process.env.DB_HOST = 'db.example.com';
            process.env.DB_PORT = '3307';
            process.env.DB_USER = 'u';
            process.env.DB_PASSWORD = 'p';
            process.env.DB_NAME = 'mydb';
            process.env.DB_SSL = 'true';
            const config = (0, connection_1.getDBConfig)();
            expect(config).toEqual({
                host: 'db.example.com',
                port: 3307,
                user: 'u',
                password: 'p',
                database: 'mydb',
                ssl: true,
            });
        });
    });
    describe('initDB', () => {
        it('creates pool with given config', () => {
            const config = {
                host: 'h',
                port: 3306,
                user: 'u',
                password: 'p',
                database: 'd',
            };
            const pool = (0, connection_1.initDB)(config);
            expect(mockCreatePool).toHaveBeenCalledWith(expect.objectContaining({
                host: 'h',
                port: 3306,
                user: 'u',
                password: 'p',
                database: 'd',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                ssl: undefined,
            }));
            expect(pool.end).toBe(mockEnd);
        });
        it('returns same pool on second call', async () => {
            await (0, connection_1.closeDB)();
            mockCreatePool.mockClear();
            const config = {
                host: 'h',
                port: 3306,
                user: 'u',
                password: 'p',
                database: 'd',
            };
            const pool1 = (0, connection_1.initDB)(config);
            const pool2 = (0, connection_1.initDB)(config);
            expect(pool1).toBe(pool2);
            expect(mockCreatePool).toHaveBeenCalledTimes(1);
        });
        it('passes ssl when config.ssl is true', async () => {
            await (0, connection_1.closeDB)();
            mockCreatePool.mockClear();
            (0, connection_1.initDB)({
                host: 'h',
                port: 3306,
                user: 'u',
                password: 'p',
                database: 'd',
                ssl: true,
            });
            expect(mockCreatePool).toHaveBeenCalledWith(expect.objectContaining({
                ssl: { rejectUnauthorized: false },
            }));
        });
    });
    describe('getDB', () => {
        it('calls initDB with getDBConfig when pool is null', async () => {
            await (0, connection_1.closeDB)();
            mockCreatePool.mockClear();
            process.env.DB_HOST = 'getdb-host';
            const pool = (0, connection_1.getDB)();
            expect(mockCreatePool).toHaveBeenCalledWith(expect.objectContaining({ host: 'getdb-host' }));
            expect(pool).toBeDefined();
        });
    });
    describe('closeDB', () => {
        it('calls pool.end and clears pool', async () => {
            (0, connection_1.initDB)({
                host: 'h',
                port: 3306,
                user: 'u',
                password: 'p',
                database: 'd',
            });
            await (0, connection_1.closeDB)();
            expect(mockEnd).toHaveBeenCalled();
            mockCreatePool.mockClear();
            (0, connection_1.getDB)();
            expect(mockCreatePool).toHaveBeenCalledTimes(1);
        });
    });
});
//# sourceMappingURL=connection.test.js.map