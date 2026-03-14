"use strict";
/**
 * スタッフ情報更新Lambda関数
 * PUT /v1/admin/staffs/{email}
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
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const crypto = __importStar(require("crypto"));
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
        // パスパラメータからemailを取得
        const rawEmail = event.pathParameters?.email;
        const email = rawEmail ? decodeURIComponent(rawEmail) : null;
        if (!email) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'email is required', 400);
        }
        // リクエストボディの解析
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const { name_kanji, name_kana, tel, org_id, remarks, password, role_flag } = JSON.parse(event.body);
        // データベース接続を取得
        const db = (0, connection_1.getDB)();
        // ユーザーの存在確認（role_flag = 2 スタッフ または 3 管理者 のみ編集可能）
        const [existingUsers] = await db.execute('SELECT email, role_flag FROM users WHERE email = ?', [email]);
        if (existingUsers.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Staff not found', 404);
        }
        const currentRole = existingUsers[0].role_flag;
        if (currentRole !== 2 && currentRole !== 3) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'User is not a staff or admin', 400);
        }
        // role_flag の変更は 2 または 3 のみ許可
        if (role_flag !== undefined) {
            if (role_flag !== 2 && role_flag !== 3) {
                return (0, response_1.errorResponse)('BAD_REQUEST', 'role_flag must be 2 (staff) or 3 (admin)', 400);
            }
        }
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
        if (password !== undefined) {
            // パスワードのハッシュ化
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            updateFields.push('password = ?');
            updateValues.push(hashedPassword);
        }
        if (role_flag !== undefined) {
            updateFields.push('role_flag = ?');
            updateValues.push(role_flag);
        }
        if (updateFields.length === 0) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'No fields to update', 400);
        }
        updateValues.push(email);
        // 更新実行
        await db.execute(`UPDATE users SET ${updateFields.join(', ')} WHERE email = ?`, updateValues);
        // 更新後のユーザー情報を取得
        const [updatedUsers] = await db.execute('SELECT email, name_kanji, name_kana, tel, org_id, remarks, role_flag, created_at, updated_at FROM users WHERE email = ?', [email]);
        return (0, response_1.successResponse)({
            staff: updatedUsers[0],
            message: 'Staff updated successfully',
        });
    }
    catch (error) {
        console.error('Update staff error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
