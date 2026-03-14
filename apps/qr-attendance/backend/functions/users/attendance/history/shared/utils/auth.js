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
 * 優先順位: Authorization（JWT または ローカル用 base64） > クエリ > ボディ
 */
function getUserEmailFromRequest(event) {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.substring(7).trim();
            let payload;
            const parts = token.split('.');
            if (parts.length >= 2) {
                payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            } else {
                payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            }
            if (payload && payload.email)
                return payload.email;
            if (payload && payload['cognito:username'])
                return payload['cognito:username'];
        }
        catch (e) { }
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
