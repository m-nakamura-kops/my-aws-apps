"use strict";
/**
 * 現在ログイン中のユーザー情報取得
 * GET /v1/users/me
 * 権限変更の即時反映用（トークンから email を取得し DB の role_flag を返す）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require("./shared/db/connection");
const secrets_1 = require("./shared/db/secrets");
const response_1 = require("./shared/utils/response");
const auth_1 = require("./shared/utils/auth");
const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        const email = (0, auth_1.getUserEmailFromRequest)(event);
        if (!email) {
            return (0, response_1.errorResponse)('UNAUTHORIZED', 'Authentication required', 401);
        }
        await (0, secrets_1.initDBFromSecrets)();
        const db = (0, connection_1.getDB)();
        const [users] = await db.execute('SELECT email, name_kanji, name_kana, role_flag, org_id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'User not found', 404);
        }
        const u = users[0];
        return (0, response_1.successResponse)({
            email: u.email,
            name_kanji: u.name_kanji,
            name_kana: u.name_kana,
            role_flag: u.role_flag,
            org_id: u.org_id,
        });
    }
    catch (error) {
        console.error('Get current user error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
