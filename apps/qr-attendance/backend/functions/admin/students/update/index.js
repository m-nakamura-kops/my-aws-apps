"use strict";
/**
 * 生徒情報更新Lambda関数
 * PUT /v1/admin/students/{email}
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const parse_path_email_1 = require('./shared/utils/parse-path-email');
const handler = async (event) => {
    // CORSプリフライトリクエスト対応
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        // 管理者権限チェック
        await (0, secrets_1.initDBFromSecrets)();
        const permissionCheck = await (0, auth_1.checkAdminPermission)(event);
        if (!permissionCheck.authorized) {
            return (0, response_1.errorResponse)('FORBIDDEN', permissionCheck.error || 'Admin access required', 403);
        }
        const rawEmail = event.pathParameters?.email;
        const parsed = (0, parse_path_email_1.parseEmailPathParamForDb)(rawEmail);
        if (!parsed.ok) {
            return (0, response_1.errorResponse)('BAD_REQUEST', parsed.reason === 'decodeURIComponent_error'
                ? 'Invalid email encoding in path'
                : 'email is required', 400);
        }
        const email = parsed.email;
        // リクエストボディの解析
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const { name_kanji, name_kana, tel, org_id, remarks, is_active } = JSON.parse(event.body);
        // 更新フィールドの構築
        const updateFields = [];
        const updateValues = [];
        if (name_kanji !== undefined) {
            updateFields.push('name_kanji = ?');
            updateValues.push(name_kanji);
        }
        if (name_kana !== undefined) {
            updateFields.push('name_kana = ?');
            updateValues.push(name_kana);
        }
        if (tel !== undefined) {
            updateFields.push('tel = ?');
            updateValues.push(tel);
        }
        if (org_id !== undefined) {
            updateFields.push('org_id = ?');
            updateValues.push(org_id);
        }
        if (remarks !== undefined) {
            updateFields.push('remarks = ?');
            updateValues.push(remarks);
        }
        if (is_active !== undefined) {
            updateFields.push('is_active = ?');
            updateValues.push(is_active ? 1 : 0);
        }
        if (updateFields.length === 0) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'No fields to update', 400);
        }
        updateValues.push(email);
        const pool = (0, connection_1.getDB)();
        const updatedUsers = await (0, connection_1.withConnection)(pool, async (conn) => {
            const [existingUsers] = (await conn.execute('SELECT email, role_flag FROM users WHERE email = ?', [email]));
            if (existingUsers.length === 0) {
                return { err: 'not_found' };
            }
            if (existingUsers[0].role_flag !== 1) {
                return { err: 'not_student' };
            }
            await conn.execute(`UPDATE users SET ${updateFields.join(', ')} WHERE email = ?`, updateValues);
            const [rows] = (await conn.execute('SELECT email, name_kanji, name_kana, tel, org_id, remarks, created_at, updated_at FROM users WHERE email = ?', [email]));
            return { err: null, student: rows[0] };
        });
        if (updatedUsers.err === 'not_found') {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Student not found', 404);
        }
        if (updatedUsers.err === 'not_student') {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'User is not a student', 400);
        }
        return (0, response_1.successResponse)({
            student: updatedUsers.student,
            message: 'Student updated successfully',
        });
    }
    catch (error) {
        console.error('Update student error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
