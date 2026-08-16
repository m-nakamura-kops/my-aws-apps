"use strict";
/**
 * スタッフ招待Lambda関数
 * POST /v1/admin/invite
 *
 * Cognito 招待と DB(users) への role_flag=2 登録をセットで保証する。
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
        if (!email) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'email is required', 400);
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid email format', 400);
        }
        if (!(0, cognito_db_sync_1.isCognitoConfigured)()) {
            return (0, response_1.errorResponse)('SERVICE_UNAVAILABLE', 'USER_POOL_ID is not configured. Cannot invite staff without Cognito.', 503);
        }
        const placeholderHash = (0, cognito_db_sync_1.randomPlaceholderPasswordHash)();
        const pool = (0, connection_1.getDB)();
        const dbPrep = await (0, connection_1.withConnection)(pool, async (conn) => {
            const upsert = await (0, cognito_db_sync_1.upsertDbUser)(conn, {
                email,
                passwordHash: placeholderHash,
                name_kanji: name_kanji || '',
                name_kana: name_kana || '',
                tel: tel || '',
                org_id: org_id || null,
                remarks: remarks || null,
                role_flag: 2,
                forceRole: true,
            });
            return { created: upsert.created };
        });
        try {
            const cognitoResult = await (0, cognito_db_sync_1.ensureCognitoInvitedUser)({
                email,
                name: name_kanji,
                resendInviteIfExists: true,
            });
            return (0, response_1.successResponse)({
                status: 'success',
                invitationSent: cognitoResult.invitationSent,
                cognitoCreated: cognitoResult.created,
                dbCreated: dbPrep.created,
                email,
                message: cognitoResult.message || 'スタッフを登録し、招待メールを送信しました',
            });
        }
        catch (cognitoError) {
            console.error('Cognito invite failed after DB upsert:', cognitoError);
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
        console.error('Invite staff error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
//# sourceMappingURL=index.js.map