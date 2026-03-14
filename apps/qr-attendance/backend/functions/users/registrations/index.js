"use strict";
/**
 * 申込一覧取得 GET /v1/users/registrations
 * 管理者: email 未指定で全利用者の申込一覧。一般: 自分の申込のみ（email 必須・本人のみ）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const role_check_1 = require('./shared/utils/role-check');
const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        const queryParams = event.queryStringParameters || {};
        const filterEmail = queryParams.email || null;
        const eventId = queryParams.event_id;
        let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
        let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
        if (isNaN(limit) || limit < 1 || limit > 1000) limit = 100;
        if (isNaN(offset) || offset < 0) offset = 0;

        await (0, secrets_1.initDBFromSecrets)();
        const db = (0, connection_1.getDB)();

        const requestEmail = (0, auth_1.getUserEmailFromRequest)(event);
        if (!requestEmail) {
            return (0, response_1.errorResponse)('UNAUTHORIZED', 'Authentication required', 401);
        }
        const roleFlag = await (0, auth_1.getUserRoleFlag)(requestEmail);
        const isAdmin = (0, role_check_1.isAdmin)(roleFlag);

        if (!isAdmin) {
            if (!filterEmail) {
                return (0, response_1.errorResponse)('BAD_REQUEST', 'email parameter is required', 400);
            }
            if (filterEmail !== requestEmail) {
                return (0, response_1.errorResponse)('FORBIDDEN', 'You can only view your own registrations', 403);
            }
        }

        const emailFilter = isAdmin ? filterEmail : requestEmail;
        const params = [];
        let whereClause = '';
        if (emailFilter) {
            whereClause = ' WHERE r.email = ?';
            params.push(emailFilter);
        }
        if (eventId) {
            whereClause += whereClause ? ' AND r.event_id = ?' : ' WHERE r.event_id = ?';
            params.push(eventId);
        }

        const limitInt = Math.min(1000, Math.max(1, limit));
        const offsetInt = Math.max(0, offset);

        let query = `
      SELECT 
        r.reg_id,
        r.email,
        u.name_kanji AS user_name,
        r.event_id,
        e.event_name,
        e.event_date,
        e.location,
        e.capacity,
        r.created_at AS registration_date
      FROM registrations r
      INNER JOIN users u ON r.email = u.email
      INNER JOIN events e ON r.event_id = e.event_id
      ${whereClause}
      ORDER BY r.created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;
        const [registrations] = await db.execute(query, params);

        let countQuery = `SELECT COUNT(*) as total FROM registrations r ${whereClause}`;
        const [countResult] = await db.execute(countQuery, params);
        const total = countResult[0]?.total || 0;

        return (0, response_1.successResponse)({
            registrations: registrations.map((reg) => ({
                reg_id: reg.reg_id,
                email: reg.email,
                user_name: reg.user_name,
                event_id: reg.event_id,
                event_name: reg.event_name,
                event_date: reg.event_date,
                location: reg.location,
                capacity: reg.capacity,
                registration_date: reg.registration_date,
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
        console.error('Get registrations error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
