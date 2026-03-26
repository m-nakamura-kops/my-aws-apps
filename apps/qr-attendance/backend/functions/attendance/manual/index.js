"use strict";
/**
 * 手動打刻実行
 * POST /v1/attendance/manual
 * 権限: 管理者(3) または スタッフ(2) のみ。event_id と email で打刻。
 * 入室: type=entry。退室: type=exit（attendance_logs に notes カラムは使わない）。
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
        const staffEmail = String(permission.email ?? '').trim();
        if (!staffEmail) {
            return (0, response_1.errorResponse)('UNAUTHORIZED', 'Staff email missing from token', 401);
        }
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        let body;
        try {
            body = JSON.parse(event.body);
        }
        catch {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid JSON body', 400);
        }
        const eventIdRaw = body.event_id ?? body.eventId;
        const email = (body.email ?? body.user_id)?.trim();
        if (eventIdRaw == null || eventIdRaw === '' || !email) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'event_id and email (or user_id) are required', 400);
        }
        const eventIdNum = parseInt(String(eventIdRaw), 10);
        if (isNaN(eventIdNum) || eventIdNum < 1) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid event_id', 400);
        }
        const actionParam = (body.action ?? body.type ?? 'entry').toString().toLowerCase();
        const isExit = actionParam === 'exit' || actionParam === 'out';
        const pool = (0, connection_1.getDB)();
        const dbResult = await (0, connection_1.withConnection)(pool, async (conn) => {
            const [events] = (await conn.execute('SELECT event_id FROM events WHERE event_id = ?', [
                eventIdNum,
            ]));
            if (events.length === 0) {
                return {
                    ok: false,
                    response: (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404),
                };
            }
            const [users] = (await conn.execute('SELECT email, role_flag FROM users WHERE email = ?', [
                email,
            ]));
            if (users.length === 0) {
                return {
                    ok: false,
                    response: (0, response_1.errorResponse)('NOT_FOUND', 'User not found', 404),
                };
            }
            if (users[0].role_flag !== role_check_1.UserRole.USER) {
                return {
                    ok: false,
                    response: (0, response_1.errorResponse)('BAD_REQUEST', 'Target user must be a student (role_flag=1)', 400),
                };
            }
            const [existingEntry] = (await conn.execute(`SELECT log_id FROM attendance_logs WHERE event_id = ? AND email = ? AND type = 'entry' LIMIT 1`, [eventIdNum, email]));
            const [existingExit] = (await conn.execute(`SELECT log_id FROM attendance_logs WHERE event_id = ? AND email = ? AND type = 'exit' LIMIT 1`, [eventIdNum, email]));
            if (isExit) {
                if (existingExit.length > 0) {
                    return {
                        ok: false,
                        response: (0, response_1.errorResponse)('CONFLICT', 'Already checked out for this event', 409),
                    };
                }
                try {
                    const [result] = (await conn.execute(`INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email)
             VALUES (?, ?, 'exit', NULL, NOW(), ?)`, [email, eventIdNum, staffEmail]));
                    const logId = result?.insertId ?? null;
                    return { ok: true, logId, action: 'exit' };
                }
                catch (insertErr) {
                    const code = insertErr?.code ?? insertErr?.errno;
                    if (code === 'ER_DUP_ENTRY' || code === 1062) {
                        return {
                            ok: false,
                            response: (0, response_1.errorResponse)('CONFLICT', 'Already checked out for this event', 409),
                        };
                    }
                    throw insertErr;
                }
            }
            if (existingEntry.length > 0) {
                return {
                    ok: false,
                    response: (0, response_1.errorResponse)('CONFLICT', 'Already checked in for this event', 409),
                };
            }
            try {
                const [result] = (await conn.execute(`INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email)
           VALUES (?, ?, 'entry', NOW(), NULL, ?)`, [email, eventIdNum, staffEmail]));
                const logId = result?.insertId ?? null;
                return { ok: true, logId, action: 'entry' };
            }
            catch (insertErr) {
                const code = insertErr?.code ?? insertErr?.errno;
                if (code === 'ER_DUP_ENTRY' || code === 1062) {
                    return {
                        ok: false,
                        response: (0, response_1.errorResponse)('CONFLICT', 'Already checked in for this event', 409),
                    };
                }
                throw insertErr;
            }
        });
        if (!dbResult.ok) {
            return dbResult.response;
        }
        const message = dbResult.action === 'exit' ? 'Manual exit recorded' : 'Manual attendance recorded';
        return (0, response_1.successResponse)({
            log_id: dbResult.logId,
            event_id: eventIdNum,
            email,
            action: dbResult.action,
            message,
        }, 201);
    }
    catch (error) {
        console.error('Manual attendance error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
