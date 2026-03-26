"use strict";
/**
 * イベント参加者一覧取得Lambda関数
 * GET /v1/admin/events/{eventId}/participants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const role_check_1 = require('./shared/utils/role-check');
function isInvalidDatetime(v) {
    if (v == null || v === '')
        return true;
    if (v instanceof Date) {
        const ms = v.getTime();
        if (Number.isNaN(ms))
            return true;
        if (v.getFullYear() < 1980)
            return true;
        return false;
    }
    const s = String(v).trim();
    if (s === '' || s === 'null' || s.startsWith('0000-00-00'))
        return true;
    const d = new Date(s);
    if (Number.isNaN(d.getTime()))
        return true;
    if (d.getFullYear() < 1980)
        return true;
    return false;
}
function toIsoOrNull(v) {
    if (isInvalidDatetime(v))
        return null;
    if (v instanceof Date)
        return v.toISOString();
    const d = new Date(String(v).trim());
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 1980)
        return null;
    return d.toISOString();
}
const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        await (0, secrets_1.initDBFromSecrets)();
        const permission = await (0, auth_1.checkStaffOrAdminPermission)(event);
        if (!permission.authorized) {
            return (0, response_1.errorResponse)(permission.statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', permission.error, permission.statusCode);
        }
        const canViewAll = (0, role_check_1.isStaffOrAdmin)(permission.roleFlag);
        const requestEmail = permission.email;
        const eventId = event.pathParameters?.eventId;
        if (!eventId) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'eventId is required', 400);
        }
        const queryParams = event.queryStringParameters || {};
        let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
        let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
        if (isNaN(limit) || limit < 1 || limit > 1000)
            limit = 100;
        if (isNaN(offset) || offset < 0)
            offset = 0;
        const pool = (0, connection_1.getDB)();
        const payload = await (0, connection_1.withConnection)(pool, async (conn) => {
            const [events] = (await conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId]));
            if (events.length === 0) {
                return { notFound: true };
            }
            const eventData = events[0];
            let rows;
            let total;
            if (canViewAll) {
                const [r] = (await conn.execute(`SELECT 
            vp.email,
            vp.name_kanji,
            vp.name_kana,
            vp.registration_date,
            u.tel,
            u.org_id,
            u.role_flag,
            (SELECT al.in_time FROM attendance_logs al
              WHERE al.event_id = vp.event_id AND al.email = vp.email
                AND al.in_time IS NOT NULL
              ORDER BY al.log_id DESC LIMIT 1) AS in_time,
            (SELECT MAX(al.out_time) FROM attendance_logs al
              WHERE al.event_id = vp.event_id AND al.email = vp.email
                AND al.out_time IS NOT NULL) AS out_time
          FROM v_event_participants vp
          INNER JOIN users u ON u.email = vp.email
          WHERE vp.event_id = ?
          ORDER BY vp.registration_date DESC
          LIMIT ? OFFSET ?`, [eventId, limit, offset]));
                rows = r || [];
                const [countResult] = (await conn.execute('SELECT COUNT(*) as total FROM v_event_participants WHERE event_id = ?', [eventId]));
                total = countResult[0]?.total || 0;
            }
            else {
                const [r] = (await conn.execute(`SELECT 
            vp.email,
            vp.name_kanji,
            vp.name_kana,
            vp.registration_date,
            u.tel,
            u.org_id,
            u.role_flag,
            (SELECT al.in_time FROM attendance_logs al
              WHERE al.event_id = vp.event_id AND al.email = vp.email
                AND al.in_time IS NOT NULL
              ORDER BY al.log_id DESC LIMIT 1) AS in_time,
            (SELECT MAX(al.out_time) FROM attendance_logs al
              WHERE al.event_id = vp.event_id AND al.email = vp.email
                AND al.out_time IS NOT NULL) AS out_time
          FROM v_event_participants vp
          INNER JOIN users u ON u.email = vp.email
          WHERE vp.event_id = ? AND vp.email = ?
          LIMIT 1`, [eventId, requestEmail]));
                rows = r || [];
                total = rows.length;
            }
            const participantsWithDetails = rows.map((row) => ({
                email: row.email,
                name_kanji: row.name_kanji,
                name_kana: row.name_kana,
                tel: row.tel ?? null,
                org_id: row.org_id ?? null,
                role_flag: row.role_flag ?? null,
                registration_date: row.registration_date,
                in_time: toIsoOrNull(row.in_time),
                out_time: toIsoOrNull(row.out_time),
            }));
            return {
                notFound: false,
                eventData,
                participantsWithDetails,
                total,
                limit,
                offset,
            };
        });
        if (payload.notFound) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
        }
        return (0, response_1.successResponse)({
            event_id: parseInt(eventId, 10),
            event_name: payload.eventData.event_name,
            event_date: payload.eventData.event_date,
            participants: payload.participantsWithDetails,
            pagination: {
                total: payload.total,
                limit: payload.limit,
                offset: payload.offset,
                hasMore: payload.offset + payload.limit < payload.total,
            },
        });
    }
    catch (error) {
        console.error('Get participants error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
