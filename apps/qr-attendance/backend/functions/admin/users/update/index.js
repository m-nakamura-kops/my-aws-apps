"use strict";
/**
 * 管理者用ユーザー情報更新Lambda関数
 * PUT /v1/admin/users/{email}
 * role_flag 変更時も attendance_logs は更新しない（退職後も打刻履歴は残す）
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require("../../../../shared/db/connection");
const secrets_1 = require("../../../../shared/db/secrets");
const response_1 = require("../../../../shared/utils/response");
const auth_1 = require("../../../../shared/utils/auth");
const crypto = __importStar(require("crypto"));
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
        const email = event.pathParameters?.email;
        if (!email) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'email is required', 400);
        }
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const body = JSON.parse(event.body);
        const { name_kanji, name_kana, tel, org_id, remarks, password, role_flag } = body;
        const db = (0, connection_1.getDB)();
        const [existing] = await db.execute('SELECT email, role_flag FROM users WHERE email = ?', [email]);
        if (existing.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'User not found', 404);
        }
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
        if (password !== undefined && password !== '') {
            const hashed = crypto.createHash('sha256').update(password).digest('hex');
            updateFields.push('password = ?');
            updateValues.push(hashed);
        }
        if (role_flag !== undefined) {
            const r = parseInt(String(role_flag), 10);
            if ([1, 2, 3].indexOf(r) === -1) {
                return (0, response_1.errorResponse)('BAD_REQUEST', 'role_flag must be 1, 2, or 3', 400);
            }
            updateFields.push('role_flag = ?');
            updateValues.push(r);
        }
        if (updateFields.length === 0) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'No fields to update', 400);
        }
        updateValues.push(email);
        await db.execute(`UPDATE users SET ${updateFields.join(', ')} WHERE email = ?`, updateValues);
        const [updated] = await db.execute('SELECT email, name_kanji, name_kana, tel, org_id, remarks, role_flag, created_at, updated_at FROM users WHERE email = ?', [email]);
        return (0, response_1.successResponse)({
            user: updated[0],
            message: 'User updated successfully',
        });
    }
    catch (error) {
        console.error('Update user error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
