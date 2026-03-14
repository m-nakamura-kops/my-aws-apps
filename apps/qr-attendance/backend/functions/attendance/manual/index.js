"use strict";
/**
 * 手動打刻実行
 * POST /v1/attendance/manual
 * 権限: 管理者(3) または スタッフ(2) のみ。event_id と email で打刻。二重打刻時は 409。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const role_check_1 = require('./shared/utils/role-check');
const NOTES_MANUAL = '手動打刻';
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
        const staffEmail = permission.email;
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        let body;
        try {
            body = JSON.parse(event.body);
        }
        catch (_) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid JSON body', 400);
        }
        const eventIdRaw = body.event_id ?? body.eventId;
        const email = (body.email ?? body.user_id) && String(body.email ?? body.user_id).trim();
        if (eventIdRaw == null || eventIdRaw === '' || !email) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'event_id and email (or user_id) are required', 400);
        }
        const eventIdNum = parseInt(String(eventIdRaw), 10);
        if (isNaN(eventIdNum) || eventIdNum < 1) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid event_id', 400);
        }
        const db = (0, connection_1.getDB)();
        const [events] = await db.execute('SELECT event_id FROM events WHERE event_id = ?', [eventIdNum]);
        if (events.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
        }
        const [users] = await db.execute('SELECT email, role_flag FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'User not found', 404);
        }
        if (users[0].role_flag !== role_check_1.UserRole.USER) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Target user must be a student (role_flag=1)', 400);
        }
        const [existing] = await db.execute('SELECT log_id FROM attendance_logs WHERE event_id = ? AND email = ? LIMIT 1', [eventIdNum, email]);
        if (existing.length > 0) {
            return (0, response_1.errorResponse)('CONFLICT', 'Already checked in for this event', 409);
        }
        try {
            const [result] = await db.execute(`INSERT INTO attendance_logs (email, event_id, in_time, staff_email, notes)
       VALUES (?, ?, NOW(), ?, ?)`, [email, eventIdNum, staffEmail, NOTES_MANUAL]);
            const logId = result?.insertId ?? null;
            return (0, response_1.successResponse)({ log_id: logId, event_id: eventIdNum, email, message: 'Manual attendance recorded' }, 201);
        }
        catch (insertErr) {
            const code = insertErr?.code ?? insertErr?.errno;
            if (code === 'ER_DUP_ENTRY' || code === 1062) {
                return (0, response_1.errorResponse)('CONFLICT', 'Already checked in for this event', 409);
            }
            throw insertErr;
        }
    }
    catch (error) {
        console.error('Manual attendance error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
