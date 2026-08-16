"use strict";
/**
 * 生徒一括登録Lambda関数（CSVインポート・管理者用）
 * POST /v1/admin/students/import
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
const validation_1 = require('./shared/utils/validation');
const csv_1 = require('./shared/utils/csv');
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
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const body = JSON.parse(event.body);
        const csv = body.csv;
        if (typeof csv !== 'string' || !csv.trim()) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Field "csv" (string) is required', 400);
        }
        const lines = csv.trim().split(/\r?\n/).filter((l) => l.trim());
        const errors = [];
        let imported = 0;
        let hadValidFormatRow = false;
        const pool = (0, connection_1.getDB)();
        await (0, connection_1.withConnection)(pool, async (conn) => {
            for (let i = 0; i < lines.length; i++) {
                const rowNum = i + 1;
                const cells = (0, csv_1.parseCSVLine)(lines[i]);
                if (cells.length < 5) {
                    errors.push({ row: rowNum, message: '列数が足りません（email, password, name_kanji, name_kana, tel 必須）' });
                    continue;
                }
                if (i === 0 && (0, csv_1.isHeaderRow)(cells)) {
                    continue;
                }
                const [email, password, name_kanji, name_kana, tel, org_id, remarks] = [
                    (cells[0] || '').trim(),
                    (cells[1] || '').trim(),
                    (cells[2] || '').trim(),
                    (cells[3] || '').trim(),
                    (cells[4] || '').trim(),
                    (cells[5] || '').trim() || null,
                    (cells[6] || '').trim() || null,
                ];
                if (!email || !password || !name_kanji || !name_kana || !tel) {
                    errors.push({ row: rowNum, email: email || undefined, message: 'email, password, name_kanji, name_kana, tel は必須です' });
                    continue;
                }
                if (!(0, validation_1.validateEmail)(email)) {
                    errors.push({ row: rowNum, email, message: 'メールアドレスの形式が不正です' });
                    continue;
                }
                if (!(0, validation_1.validatePassword)(password)) {
                    errors.push({ row: rowNum, email, message: 'パスワードは8文字以上にしてください' });
                    continue;
                }
                hadValidFormatRow = true;
                try {
                    const [existing] = (await conn.execute('SELECT email FROM users WHERE email = ?', [email]));
                    if (existing.length > 0) {
                        errors.push({ row: rowNum, email, message: '既に登録されているメールアドレスです' });
                        continue;
                    }
                    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
                    await conn.execute(`INSERT INTO users (email, password, name_kanji, name_kana, tel, org_id, role_flag, remarks)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)`, [email, hashedPassword, name_kanji, name_kana, tel, org_id, remarks]);
                    imported++;
                }
                catch (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        errors.push({ row: rowNum, email, message: '既に登録されているメールアドレスです' });
                    }
                    else {
                        errors.push({ row: rowNum, email, message: err.message || '登録に失敗しました' });
                    }
                }
            }
        });
        // 形式不正のときだけ 400（形式上有効な行が1件もない場合）
        if (imported === 0 && errors.length > 0 && !hadValidFormatRow) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'CSV format is invalid or all rows have errors', 400, { errors: errors.slice(0, 20) });
        }
        return (0, response_1.successResponse)({
            imported,
            totalRows: lines.length,
            errors: errors.slice(0, 100),
        });
    }
    catch (error) {
        console.error('Import students error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
