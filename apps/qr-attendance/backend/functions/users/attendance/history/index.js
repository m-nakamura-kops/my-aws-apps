"use strict";
/**
 * 打刻履歴取得Lambda関数
 * GET /v1/users/attendance/history
 * 権限マトリクス: 利用者・スタッフ・管理者とも「自分の打刻履歴」のみ取得可能。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        const queryParams = event.queryStringParameters || {};
        const eventId = queryParams.event_id;
        let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
        let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
        const startDate = queryParams.start_date;
        const endDate = queryParams.end_date;

        if (isNaN(limit) || limit < 1 || limit > 1000)
            limit = 100;
        if (isNaN(offset) || offset < 0)
            offset = 0;

        await (0, secrets_1.initDBFromSecrets)();
        const db = (0, connection_1.getDB)();

        const requestEmail = (0, auth_1.getUserEmailFromRequest)(event);
        if (!requestEmail) {
            return (0, response_1.errorResponse)('UNAUTHORIZED', 'Authentication required', 401);
        }

        const emailFilter = requestEmail;
        const params = [];
        let whereClause = '';
        if (emailFilter) {
            whereClause = ' WHERE al.email = ?';
            params.push(emailFilter);
        }
        if (eventId) {
            whereClause += whereClause ? ' AND al.event_id = ?' : ' WHERE al.event_id = ?';
            params.push(eventId);
        }
        if (startDate) {
            whereClause += whereClause ? ' AND al.in_time >= ?' : ' WHERE al.in_time >= ?';
            params.push(startDate);
        }
        if (endDate) {
            whereClause += whereClause ? ' AND al.in_time <= ?' : ' WHERE al.in_time <= ?';
            params.push(endDate);
        }

        const limitInt = Math.min(1000, Math.max(1, limit));
        const offsetInt = Math.max(0, offset);

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
      ${whereClause}
      ORDER BY al.in_time DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;
        const [logs] = await db.execute(query, params);

        let countQuery = `SELECT COUNT(*) as total FROM attendance_logs al ${whereClause}`;
        const [countResult] = await db.execute(countQuery, params);
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
                limit: limitInt,
                offset: offsetInt,
                hasMore: offsetInt + limitInt < total,
            },
        });
    }
    catch (error) {
        console.error('Get attendance history error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
