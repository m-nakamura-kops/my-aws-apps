"use strict";
/**
 * スタッフアカウント物理削除
 * DELETE /v1/admin/staffs/{email}
 * DB の users 行を削除（関連は CASCADE / 事前に staff_email 参照を除去）。可能なら Cognito ユーザーも削除。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const parse_path_email_1 = require('./shared/utils/parse-path-email');
const cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'ap-northeast-1',
});
const userPoolId = process.env.USER_POOL_ID || '';
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
        const rawEmail = event.pathParameters?.email;
        const parsed = (0, parse_path_email_1.parseEmailPathParamForDb)(rawEmail);
        if (!parsed.ok) {
            console.log(JSON.stringify({
                msg: '[admin/staffs/delete] parse failed',
                requestId: event.requestContext?.requestId,
                rawPathParamEmail: rawEmail ?? null,
                reason: parsed.reason,
            }));
            return (0, response_1.errorResponse)('BAD_REQUEST', parsed.reason === 'decodeURIComponent_error'
                ? 'Invalid email encoding in path'
                : 'email is required', 400);
        }
        const email = parsed.email;
        console.log(JSON.stringify({
            msg: '[admin/staffs/delete] before_sql',
            requestId: event.requestContext?.requestId,
            path: event.path,
            rawPathParamEmail: rawEmail ?? null,
            emailForSql: email,
            emailUtf8Hex: Buffer.from(email, 'utf8').toString('hex'),
        }));
        if (permissionCheck.email && permissionCheck.email.toLowerCase() === email.toLowerCase()) {
            return (0, response_1.errorResponse)('FORBIDDEN', '自分自身のアカウントは削除できません', 403);
        }
        const pool = (0, connection_1.getDB)();
        const outcome = await (0, connection_1.withConnection)(pool, async (conn) => {
            const [existingUsers] = (await conn.execute('SELECT email, role_flag FROM users WHERE email = ?', [email]));
            if (existingUsers.length === 0) {
                return { err: 'not_found' };
            }
            const role = existingUsers[0].role_flag;
            if (role !== 2 && role !== 3) {
                return { err: 'not_staff' };
            }
            // staff_email は ON DELETE RESTRICT のため先に除去
            await conn.execute('DELETE FROM attendance_logs WHERE staff_email = ?', [email]);
            await conn.execute('DELETE FROM users WHERE email = ?', [email]);
            return { err: null };
        });
        if (outcome.err === 'not_found') {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Staff not found', 404);
        }
        if (outcome.err === 'not_staff') {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'User is not a staff or admin', 400);
        }
        let cognito_deleted = false;
        let cognito_error;
        if (userPoolId) {
            try {
                await cognitoClient.send(new client_cognito_identity_provider_1.AdminDeleteUserCommand({
                    UserPoolId: userPoolId,
                    Username: email,
                }));
                cognito_deleted = true;
            }
            catch (e) {
                if (e.name === 'UserNotFoundException') {
                    cognito_deleted = false;
                }
                else {
                    cognito_error = e.message || String(e);
                    console.error('Cognito AdminDeleteUser error:', e);
                }
            }
        }
        return (0, response_1.successResponse)({
            message: 'アカウントを削除しました',
            email,
            cognito_deleted,
            ...(cognito_error ? { cognito_error } : {}),
        });
    }
    catch (error) {
        console.error('Delete staff error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
