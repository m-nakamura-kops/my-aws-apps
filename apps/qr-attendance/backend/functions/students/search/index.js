"use strict";
/**
 * 生徒検索（手動打刻用）
 * GET /v1/students/search
 * 権限: 管理者(3) または スタッフ(2) のみ。q で name_kanji / name_kana の部分一致検索。role_flag=1 限定。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require("./shared/db/connection");
const secrets_1 = require("./shared/db/secrets");
const response_1 = require("./shared/utils/response");
const auth_1 = require("./shared/utils/auth");
const role_check_1 = require("./shared/utils/role-check");
/** LIKE 用の % _ \ をエスケープ */
function escapeLike(value) {
    return value.replace(/[\\%_]/g, '\\$&');
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
        const q = (event.queryStringParameters?.q ?? '').trim();
        if (!q) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Query parameter "q" is required', 400);
        }
        const likePattern = `%${escapeLike(q)}%`;
        const db = (0, connection_1.getDB)();
        const [rows] = await db.execute(`SELECT email AS user_id, name_kanji, name_kana, email
       FROM users
       WHERE role_flag = ?
         AND (name_kanji LIKE ? OR name_kana LIKE ?)
       ORDER BY name_kana ASC
       LIMIT 50`, [role_check_1.UserRole.USER, likePattern, likePattern]);
        const users = (rows || []).map((r) => ({
            user_id: r.user_id,
            name_kanji: r.name_kanji,
            name_kana: r.name_kana,
            email: r.email,
        }));
        return (0, response_1.successResponse)({ users });
    }
    catch (error) {
        console.error('Students search error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
