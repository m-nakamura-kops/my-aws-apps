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
            let participants;
            let total;
            if (canViewAll) {
                const [rows] = (await conn.execute(`SELECT 
          email,
          name_kanji,
          name_kana,
          registration_date
        FROM v_event_participants
        WHERE event_id = ?
        ORDER BY registration_date DESC
        LIMIT ${limit} OFFSET ${offset}`, [eventId]));
                participants = rows || [];
                const [countResult] = (await conn.execute('SELECT COUNT(*) as total FROM v_event_participants WHERE event_id = ?', [eventId]));
                total = countResult[0]?.total || 0;
            }
            else {
                const [rows] = (await conn.execute(`SELECT 
          email,
          name_kanji,
          name_kana,
          registration_date
        FROM v_event_participants
        WHERE event_id = ? AND email = ?
        LIMIT 1`, [eventId, requestEmail]));
                participants = rows || [];
                total = participants.length;
            }
            const participantsWithDetails = [];
            for (const participant of participants) {
                const [users] = (await conn.execute('SELECT tel, org_id, role_flag FROM users WHERE email = ?', [participant.email]));
                participantsWithDetails.push({
                    email: participant.email,
                    name_kanji: participant.name_kanji,
                    name_kana: participant.name_kana,
                    tel: users[0]?.tel || null,
                    org_id: users[0]?.org_id || null,
                    role_flag: users[0]?.role_flag || null,
                    registration_date: participant.registration_date,
                });
            }
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
