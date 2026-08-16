"use strict";
/**
 * 手動打刻実行
 * POST /v1/attendance/manual
 * 権限: 管理者(3) または スタッフ(2) のみ。event_id と email で打刻。
 * 入室: 新規 INSERT（type=entry, in_time=JST, out_time=NULL）。
 * 退室: 未退室の最新入室行の out_time を UPDATE（新規 INSERT しない）。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require("./shared/db/connection");
const secrets_1 = require("./shared/db/secrets");
const response_1 = require("./shared/utils/response");
const auth_1 = require("./shared/utils/auth");
const role_check_1 = require("./shared/utils/role-check");
function nowJstMysqlDatetime() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
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
        const nowJst = nowJstMysqlDatetime();
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
            if (isExit) {
                const [openRows] = (await conn.execute(`SELECT log_id, in_time FROM attendance_logs
           WHERE event_id = ? AND email = ?
             AND in_time IS NOT NULL AND out_time IS NULL
           ORDER BY log_id DESC LIMIT 1`, [eventIdNum, email]));
                if (openRows.length === 0) {
                    return {
                        ok: false,
                        response: (0, response_1.errorResponse)('BAD_REQUEST', 'No open check-in to check out', 400),
                    };
                }
                const open = openRows[0];
                await conn.execute(`UPDATE attendance_logs
           SET out_time = ?, staff_email = ?, updated_at = CURRENT_TIMESTAMP
           WHERE log_id = ? AND out_time IS NULL`, [nowJst, staffEmail, open.log_id]);
                return {
                    ok: true,
                    logId: Number(open.log_id),
                    action: 'exit',
                    in_time: open.in_time ?? null,
                    out_time: nowJst,
                };
            }
            const [openForEntry] = (await conn.execute(`SELECT log_id FROM attendance_logs
         WHERE event_id = ? AND email = ?
           AND in_time IS NOT NULL AND out_time IS NULL
         LIMIT 1`, [eventIdNum, email]));
            if (openForEntry.length > 0) {
                return {
                    ok: false,
                    response: (0, response_1.errorResponse)('CONFLICT', 'Already checked in (not yet checked out)', 409),
                };
            }
            try {
                const [result] = (await conn.execute(`INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email)
           VALUES (?, ?, 'entry', ?, NULL, ?)`, [email, eventIdNum, nowJst, staffEmail]));
                const logId = result?.insertId ?? null;
                return { ok: true, logId, action: 'entry', in_time: nowJst, out_time: null };
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
            action: dbResult.action === 'exit' ? 'out' : 'in',
            in_time: dbResult.in_time ?? null,
            out_time: dbResult.out_time ?? null,
            message,
        });
    }
    catch (error) {
        console.error('Manual attendance error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
//# sourceMappingURL=index.js.map