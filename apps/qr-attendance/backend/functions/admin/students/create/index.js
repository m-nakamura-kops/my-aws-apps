"use strict";
/**
 * 生徒登録Lambda関数（管理者用）
 * POST /v1/admin/students
 *
 * Cognito 招待ユーザー作成と DB(users) 挿入をセットで行い、
 * 片側だけの成功状態を残さない。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require("./shared/db/connection");
const secrets_1 = require("./shared/db/secrets");
const response_1 = require("./shared/utils/response");
const auth_1 = require("./shared/utils/auth");
const cognito_db_sync_1 = require("./shared/utils/cognito-db-sync");
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
        const { email, name_kanji, name_kana, tel, org_id, remarks } = JSON.parse(event.body);
        if (!email || !name_kanji || !name_kana || !tel) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'email, name_kanji, name_kana, and tel are required', 400);
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid email format', 400);
        }
        if (!(0, cognito_db_sync_1.isCognitoConfigured)()) {
            return (0, response_1.errorResponse)('SERVICE_UNAVAILABLE', 'USER_POOL_ID is not configured. Cannot invite students without Cognito.', 503);
        }
        const placeholderHash = (0, cognito_db_sync_1.randomPlaceholderPasswordHash)();
        const pool = (0, connection_1.getDB)();
        const dbPrep = await (0, connection_1.withConnection)(pool, async (conn) => {
            const [existingUsers] = (await conn.execute('SELECT email, role_flag FROM users WHERE email = ?', [email]));
            if (existingUsers.length > 0) {
                const rf = existingUsers[0].role_flag;
                if (rf === 2 || rf === 3) {
                    return { ok: false, reason: 'not_student_role' };
                }
            }
            const upsert = await (0, cognito_db_sync_1.upsertDbUser)(conn, {
                email,
                passwordHash: placeholderHash,
                name_kanji,
                name_kana,
                tel,
                org_id: org_id || null,
                remarks: remarks || null,
                role_flag: 1,
            });
            return { ok: true, created: upsert.created };
        });
        if (!dbPrep.ok) {
            return (0, response_1.errorResponse)('CONFLICT', 'このメールアドレスはスタッフまたは管理者として既に登録されています', 409);
        }
        try {
            const cognitoResult = await (0, cognito_db_sync_1.ensureCognitoInvitedUser)({
                email,
                name: name_kanji,
                resendInviteIfExists: true,
            });
            return (0, response_1.successResponse)({
                userId: email,
                status: 'success',
                invitationSent: cognitoResult.invitationSent,
                cognitoCreated: cognitoResult.created,
                dbCreated: dbPrep.created,
                message: cognitoResult.message || '生徒を登録し、招待メールを送信しました',
            }, 201);
        }
        catch (cognitoError) {
            console.error('Cognito invite failed after DB upsert:', cognitoError);
            // 新規 DB 行だけ残さない（補償削除）
            if (dbPrep.created) {
                try {
                    await (0, connection_1.withConnection)(pool, async (conn) => (0, cognito_db_sync_1.deleteDbUser)(conn, email));
                }
                catch (rollbackErr) {
                    console.error('DB rollback after Cognito failure failed:', rollbackErr);
                }
            }
            return (0, response_1.errorResponse)('INTERNAL_ERROR', 'Cognito への招待ユーザー作成に失敗したため、登録を中止しました', 502, cognitoError?.message);
        }
    }
    catch (error) {
        console.error('Create student error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return (0, response_1.errorResponse)('CONFLICT', 'User with this email already exists', 409);
        }
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
//# sourceMappingURL=index.js.map