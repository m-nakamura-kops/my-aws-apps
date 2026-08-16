"use strict";
/**
 * 認証・権限チェックユーティリティ
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserEmailFromRequest = getUserEmailFromRequest;
exports.getUserRoleFlag = getUserRoleFlag;
exports.checkAdminPermission = checkAdminPermission;
const connection_1 = require("../db/connection");
const role_check_1 = require("./role-check");
/**
 * リクエストからユーザーemailを取得
 * 優先順位: Authorizationヘッダー（JWT または ローカル用 base64 JSON） > クエリパラメータ > リクエストボディ
 */
function getUserEmailFromRequest(event) {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.substring(7).trim();
            // JWT形式（3部分）: payload は2番目の部分
            const parts = token.split('.');
            if (parts.length >= 2) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                if (payload.email)
                    return payload.email;
            }
            // ローカル開発用: トークン全体が base64 の JSON（email を含む）
            const payload = JSON.parse(Buffer.from(token, 'base64').toString());
            if (payload.email)
                return payload.email;
        }
        catch (e) {
            // トークンの解析に失敗した場合は無視
        }
    }
    // クエリパラメータから取得
    if (event.queryStringParameters?.email) {
        return event.queryStringParameters.email;
    }
    // リクエストボディから取得
    if (event.body) {
        try {
            const body = JSON.parse(event.body);
            if (body.email) {
                return body.email;
            }
        }
        catch (e) {
            // ボディの解析に失敗した場合は無視
        }
    }
    return null;
}
/**
 * ユーザーのrole_flagを取得
 */
async function getUserRoleFlag(email) {
    const db = (0, connection_1.getDB)();
    const [users] = await db.execute('SELECT role_flag FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
        return null;
    }
    return users[0].role_flag || null;
}
/**
 * 管理者権限チェック
 */
async function checkAdminPermission(event) {
    const email = getUserEmailFromRequest(event);
    if (!email) {
        return {
            authorized: false,
            email: null,
            error: 'User email is required. Please provide email in query parameter or Authorization header.',
        };
    }
    const roleFlag = await getUserRoleFlag(email);
    if (!(0, role_check_1.isAdmin)(roleFlag)) {
        return {
            authorized: false,
            email,
            error: 'Admin access required. Only administrators can access this resource.',
        };
    }
    return {
        authorized: true,
        email,
    };
}
