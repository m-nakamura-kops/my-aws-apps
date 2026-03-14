"use strict";
/**
 * 生徒削除Lambda関数
 * DELETE /v1/admin/students/{email}
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const userPoolId = process.env.USER_POOL_ID || '';
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
        const email = event.pathParameters?.email;
        if (!email) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'email is required', 400);
        }
        // データベース接続を取得
        const db = (0, connection_1.getDB)();
        // ユーザーの存在確認（role_flag = 1: 生徒であることを確認）
        const [existingUsers] = await db.execute('SELECT email, role_flag FROM users WHERE email = ?', [email]);
        if (existingUsers.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Student not found', 404);
        }
        if (existingUsers[0].role_flag !== 1) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'User is not a student', 400);
        }
        // データベースから削除（CASCADEにより関連するregistrationsとattendance_logsも削除される）
        await db.execute('DELETE FROM users WHERE email = ?', [email]);
        // Cognitoからも削除（オプション）
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
            // Cognitoのエラーは無視して続行（データベースからは削除済み）
        }
        return (0, response_1.successResponse)({
            message: 'Student deleted successfully',
            email: email,
        });
    }
    catch (error) {
        console.error('Delete student error:', error);
        // 外部キー制約エラーの処理
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return (0, response_1.errorResponse)('CONFLICT', 'Cannot delete student because there are related records (attendance logs, etc.)', 409);
        }
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
