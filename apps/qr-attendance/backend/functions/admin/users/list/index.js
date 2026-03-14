"use strict";
/**
 * 管理者用ユーザー一覧取得Lambda関数
 * GET /v1/admin/users
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require("../../../../shared/db/connection");
const secrets_1 = require("../../../../shared/db/secrets");
const response_1 = require("../../../../shared/utils/response");
const auth_1 = require("../../../../shared/utils/auth");
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
        const queryParams = event.queryStringParameters || {};
        let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 200;
        let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
        const search = queryParams.search;
        if (isNaN(limit) || limit < 1 || limit > 500)
            limit = 200;
        if (isNaN(offset) || offset < 0)
            offset = 0;
        const db = (0, connection_1.getDB)();
        let query = `
      SELECT email, name_kanji, name_kana, tel, org_id, remarks, role_flag, created_at, updated_at
      FROM users
    `;
        const params = [];
        const countParams = [];
        if (search) {
            query += ` WHERE (name_kanji LIKE ? OR name_kana LIKE ? OR email LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern, searchPattern);
        }
        const countQuery = search
            ? `SELECT COUNT(*) as total FROM users WHERE (name_kanji LIKE ? OR name_kana LIKE ? OR email LIKE ?)`
            : `SELECT COUNT(*) as total FROM users`;
        const [countResult] = await db.execute(countQuery, countParams.length ? countParams : []);
        const total = countResult[0]?.total || 0;
        query += search ? ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}` : ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        const [users] = await db.execute(query, params);
        const formatted = (users || []).map((u) => ({
            email: u.email,
            name_kanji: u.name_kanji,
            name_kana: u.name_kana,
            tel: u.tel,
            org_id: u.org_id,
            remarks: u.remarks,
            role_flag: u.role_flag,
            created_at: u.created_at,
            updated_at: u.updated_at,
        }));
        return (0, response_1.successResponse)({
            users: formatted,
            pagination: { total, limit, offset, hasMore: offset + limit < total },
        });
    }
    catch (error) {
        console.error('List users error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
