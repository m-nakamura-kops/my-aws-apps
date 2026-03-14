"use strict";
/**
 * 打刻履歴取得Lambda関数
 * GET /v1/users/attendance/history
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require("../../../../shared/db/connection");
const secrets_1 = require("../../../../shared/db/secrets");
const response_1 = require("../../../../shared/utils/response");
const handler = async (event) => {
    // CORSプリフライトリクエスト対応
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        // クエリパラメータの取得
        const queryParams = event.queryStringParameters || {};
        const email = queryParams.email;
        const eventId = queryParams.event_id;
        let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
        let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
        const startDate = queryParams.start_date;
        const endDate = queryParams.end_date;
        // 値の検証
        if (isNaN(limit) || limit < 1 || limit > 1000) {
            limit = 100;
        }
        if (isNaN(offset) || offset < 0) {
            offset = 0;
        }
        if (!email) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'email parameter is required', 400);
        }
        // データベース接続を初期化
        await (0, secrets_1.initDBFromSecrets)();
        const db = (0, connection_1.getDB)();
        // 打刻履歴取得（ビューを使用して詳細情報を含める）
        let query = `
      SELECT 
        al.log_id,
        al.email,
        u.name_kanji AS user_name,
        al.event_id,
        e.event_name,
        e.event_date,
        al.in_time,
        al.out_time,
        TIMESTAMPDIFF(MINUTE, al.in_time, al.out_time) AS stay_minutes,
        al.staff_email,
        staff.name_kanji AS staff_name,
        al.created_at
      FROM attendance_logs al
      INNER JOIN users u ON al.email = u.email
      INNER JOIN events e ON al.event_id = e.event_id
      INNER JOIN users staff ON al.staff_email = staff.email
      WHERE al.email = ?
    `;
        const params = [email];
        if (eventId) {
            query += ' AND al.event_id = ?';
            params.push(eventId);
        }
        if (startDate) {
            query += ' AND al.in_time >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND al.in_time <= ?';
            params.push(endDate);
        }
        query += ` ORDER BY al.in_time DESC LIMIT ${limit} OFFSET ${offset}`;
        const [logs] = await db.execute(query, params);
        // 総件数を取得
        let countQuery = `
      SELECT COUNT(*) as total
      FROM attendance_logs al
      WHERE al.email = ?
    `;
        const countParams = [email];
        if (eventId) {
            countQuery += ' AND al.event_id = ?';
            countParams.push(eventId);
        }
        if (startDate) {
            countQuery += ' AND al.in_time >= ?';
            countParams.push(startDate);
        }
        if (endDate) {
            countQuery += ' AND al.in_time <= ?';
            countParams.push(endDate);
        }
        const [countResult] = await db.execute(countQuery, countParams);
        const total = countResult[0]?.total || 0;
        return (0, response_1.successResponse)({
            logs: logs.map((log) => ({
                log_id: log.log_id,
                email: log.email,
                user_name: log.user_name,
                event_id: log.event_id,
                event_name: log.event_name,
                event_date: log.event_date,
                in_time: log.in_time,
                out_time: log.out_time,
                stay_minutes: log.stay_minutes,
                staff_email: log.staff_email,
                staff_name: log.staff_name,
                created_at: log.created_at,
            })),
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            },
        });
    }
    catch (error) {
        console.error('Get attendance history error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
