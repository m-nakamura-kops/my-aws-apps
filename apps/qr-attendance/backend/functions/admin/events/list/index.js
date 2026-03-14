"use strict";
/**
 * イベント一覧取得Lambda関数
 * GET /v1/admin/events
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const handler = async (event) => {
    // CORSプリフライトリクエスト対応
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        // 管理者権限チェック
        await (0, secrets_1.initDBFromSecrets)();
        const permissionCheck = await (0, auth_1.checkAdminPermission)(event);
        if (!permissionCheck.authorized) {
            return (0, response_1.errorResponse)('FORBIDDEN', permissionCheck.error || 'Admin access required', 403);
        }
        // クエリパラメータの取得
        const queryParams = event.queryStringParameters || {};
        let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
        let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
        const startDate = queryParams.start_date;
        const endDate = queryParams.end_date;
        // 値の検証（SQLインジェクション対策）
        if (isNaN(limit) || limit < 1 || limit > 1000) {
            limit = 100;
        }
        if (isNaN(offset) || offset < 0) {
            offset = 0;
        }
        // データベース接続を初期化
        await (0, secrets_1.initDBFromSecrets)();
        const db = (0, connection_1.getDB)();
        // イベント一覧取得
        let query = 'SELECT * FROM events WHERE 1=1';
        const params = [];
        if (startDate) {
            query += ' AND event_date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND event_date <= ?';
            params.push(endDate);
        }
        query += ` ORDER BY event_date DESC LIMIT ${limit} OFFSET ${offset}`;
        const [events] = await db.execute(query, params);
        // 総件数を取得
        let countQuery = 'SELECT COUNT(*) as total FROM events WHERE 1=1';
        const countParams = [];
        if (startDate) {
            countQuery += ' AND event_date >= ?';
            countParams.push(startDate);
        }
        if (endDate) {
            countQuery += ' AND event_date <= ?';
            countParams.push(endDate);
        }
        const [countResult] = await db.execute(countQuery, countParams);
        const total = countResult[0]?.total || 0;
        return (0, response_1.successResponse)({
            events: events || [],
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            },
        });
    }
    catch (error) {
        console.error('List events error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
