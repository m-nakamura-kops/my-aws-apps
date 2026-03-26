"use strict";
/**
 * 生徒削除Lambda関数
 * DELETE /v1/admin/students/{email}
 *
 * --- DB・スタッフ削除との差分（調査メモ）---
 * - users テーブルはスタッフ・生徒共通。主キーは email（schema.sql PRIMARY KEY (email)）。
 * - 生徒一覧は role_flag = 1 のみ。削除時も同一テーブルで email + role_flag=1 を必須。
 * - 404「Student not found」: 該当 email の行が存在しないときのみ（SELECT が 0 件）。
 * - 400「User is not a student」: 行はあるが role_flag が 1 以外（スタッフ/管理者）のとき。
 * - スタッフ削除は先に attendance_logs.staff_email を消してから users を削除。生徒削除は
 *   attendance_logs.email は ON DELETE CASCADE のため通常は追加 DELETE 不要。
 * - パス上のメールと DB 保存値の不一致（未デコード・二重エンコード・見えない空白）が
 *   404 の典型原因。decode は必ず最初の段階で行い、その後に空白除去する。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const parse_path_email_1 = require('./shared/utils/parse-path-email');
const cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const userPoolId = process.env.USER_POOL_ID || '';
function logEmailForCloudWatch(phase, event, rawPathParam, emailForSql) {
    const hex = Buffer.from(emailForSql, 'utf8').toString('hex');
    console.log(JSON.stringify({
        msg: '[admin/students/delete]',
        phase,
        requestId: event.requestContext?.requestId,
        path: event.path,
        rawPathParamEmail: rawPathParam ?? null,
        emailForSql,
        emailLength: emailForSql.length,
        emailUtf8Hex: hex,
    }));
}
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
                msg: '[admin/students/delete] parse failed',
                requestId: event.requestContext?.requestId,
                path: event.path,
                rawPathParamEmail: rawEmail ?? null,
                reason: parsed.reason,
            }));
            return (0, response_1.errorResponse)('BAD_REQUEST', parsed.reason === 'decodeURIComponent_error'
                ? 'Invalid email encoding in path'
                : 'email is required', 400);
        }
        const email = parsed.email;
        logEmailForCloudWatch('after_parse_before_sql', event, rawEmail, email);
        const pool = (0, connection_1.getDB)();
        const ok = await (0, connection_1.withConnection)(pool, async (conn) => {
            logEmailForCloudWatch('immediately_before_select', event, rawEmail, email);
            const [existingUsers] = (await conn.execute('SELECT email, role_flag FROM users WHERE email = ?', [email]));
            console.log(JSON.stringify({
                msg: '[admin/students/delete] select result',
                requestId: event.requestContext?.requestId,
                rowCount: existingUsers.length,
                roleFlag: existingUsers[0]?.role_flag ?? null,
            }));
            if (existingUsers.length === 0) {
                return 'not_found';
            }
            if (existingUsers[0].role_flag !== 1) {
                return 'not_student';
            }
            logEmailForCloudWatch('immediately_before_delete', event, rawEmail, email);
            await conn.execute('DELETE FROM users WHERE email = ?', [email]);
            return 'ok';
        });
        if (ok === 'not_found') {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Student not found', 404);
        }
        if (ok === 'not_student') {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'User is not a student', 400);
        }
        try {
            if (userPoolId) {
                await cognitoClient.send(new client_cognito_identity_provider_1.AdminDeleteUserCommand({
                    UserPoolId: userPoolId,
                    Username: email,
                }));
            }
        }
        catch (cognitoError) {
            console.error('Cognito user deletion error:', cognitoError);
        }
        return (0, response_1.successResponse)({
            message: 'Student deleted successfully',
            email: email,
        });
    }
    catch (error) {
        console.error('Delete student error:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return (0, response_1.errorResponse)('CONFLICT', 'Cannot delete student because there are related records (attendance logs, etc.)', 409);
        }
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
