"use strict";
/**
 * イベント参加者一覧取得Lambda関数
 * GET /v1/admin/events/{eventId}/participants
 * 権限マトリクス: 出席確認画面 — スタッフ・管理者は全員の打刻状況、利用者は自身の打刻状況のみ閲覧可。
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
        const requestEmail = (0, auth_1.getUserEmailFromRequest)(event);
        if (!requestEmail) {
            return (0, response_1.errorResponse)('UNAUTHORIZED', 'Authentication required', 401);
        }
        const roleFlag = await (0, auth_1.getUserRoleFlag)(requestEmail);
        const canViewAll = (0, role_check_1.isStaffOrAdmin)(roleFlag);
        const eventId = event.pathParameters?.eventId;
        if (!eventId) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'eventId is required', 400);
        }
        const queryParams = event.queryStringParameters || {};
        let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
        let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
        if (isNaN(limit) || limit < 1 || limit > 1000) limit = 100;
        if (isNaN(offset) || offset < 0) offset = 0;
        const db = (0, connection_1.getDB)();
        const [events] = await db.execute('SELECT * FROM events WHERE event_id = ?', [eventId]);
        if (events.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
        }
        const eventData = events[0];
        let participants;
        let total;
        if (canViewAll) {
            const [rows] = await db.execute(`SELECT email, name_kanji, name_kana, registration_date
        FROM v_event_participants WHERE event_id = ? ORDER BY registration_date DESC LIMIT ${limit} OFFSET ${offset}`, [eventId]);
            participants = rows || [];
            const [countResult] = await db.execute('SELECT COUNT(*) as total FROM v_event_participants WHERE event_id = ?', [eventId]);
            total = countResult[0]?.total || 0;
        } else {
            const [rows] = await db.execute(`SELECT email, name_kanji, name_kana, registration_date
        FROM v_event_participants WHERE event_id = ? AND email = ? LIMIT 1`, [eventId, requestEmail]);
            participants = rows || [];
            total = participants.length;
        }
        const participantsWithDetails = await Promise.all(participants.map(async (participant) => {
            const [users] = await db.execute('SELECT tel, org_id, role_flag FROM users WHERE email = ?', [participant.email]);
            return {
                email: participant.email,
                name_kanji: participant.name_kanji,
                name_kana: participant.name_kana,
                tel: users[0]?.tel || null,
                org_id: users[0]?.org_id || null,
                role_flag: users[0]?.role_flag || null,
                registration_date: participant.registration_date,
            };
        }));
        return (0, response_1.successResponse)({
            event_id: parseInt(eventId, 10),
            event_name: eventData.event_name,
            event_date: eventData.event_date,
            participants: participantsWithDetails,
            pagination: { total, limit, offset, hasMore: offset + limit < total },
        });
    }
    catch (error) {
        console.error('Get participants error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
