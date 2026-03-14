"use strict";
/**
 * スタッフ削除Lambda関数（利用者に変更）
 * DELETE /v1/admin/staffs/{email}
 * スタッフ/管理者を「利用者」に変更するのみ。アカウントは削除しない。
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
        await (0, secrets_1.initDBFromSecrets)();
        const permissionCheck = await (0, auth_1.checkAdminPermission)(event);
        if (!permissionCheck.authorized) {
            return (0, response_1.errorResponse)('FORBIDDEN', permissionCheck.error || 'Admin access required', 403);
        }
        const rawEmail = event.pathParameters?.email;
        const email = rawEmail ? decodeURIComponent(rawEmail) : null;
        if (!email) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'email is required', 400);
        }
        const db = (0, connection_1.getDB)();
        const [existingUsers] = await db.execute('SELECT email, role_flag FROM users WHERE email = ?', [email]);
        if (existingUsers.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Staff not found', 404);
        }
        const role = existingUsers[0].role_flag;
        if (role !== 2 && role !== 3) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'User is not a staff or admin', 400);
        }
        await db.execute('UPDATE users SET role_flag = 1 WHERE email = ?', [email]);
        const [attendanceLogs] = await db.execute('SELECT COUNT(*) as count FROM attendance_logs WHERE staff_email = ?', [email]);
        const logCount = attendanceLogs[0]?.count || 0;
        return (0, response_1.successResponse)({
            message: 'スタッフを利用者に変更しました',
            email: email,
            attendance_records_count: logCount,
        });
    }
    catch (error) {
        console.error('Delete staff error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
