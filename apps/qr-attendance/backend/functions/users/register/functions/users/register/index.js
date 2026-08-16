"use strict";
/**
 * ユーザー登録Lambda関数
 * POST /v1/users/register
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const connection_1 = require("../../../shared/db/connection");
const secrets_1 = require("../../../shared/db/secrets");
const response_1 = require("../../../shared/utils/response");
const cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const userPoolId = process.env.USER_POOL_ID || '';
const handler = async (event) => {
    // CORSプリフライトリクエスト対応
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        // リクエストボディの解析
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const { email, password, name_kanji, name_kana, tel } = JSON.parse(event.body);
        if (!email || !password || !name_kanji || !name_kana || !tel) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Email, password, name_kanji, name_kana, and tel are required', 400);
        }
        // Cognitoでユーザー登録
        const signUpCommand = new client_cognito_identity_provider_1.SignUpCommand({
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: email,
            Password: password,
            UserAttributes: [
                { Name: 'email', Value: email },
            ],
        });
        const signUpResponse = await cognitoClient.send(signUpCommand);
        // 開発環境では自動確認（本番環境ではメール確認が必要）
        if (process.env.NODE_ENV === 'development' || process.env.AUTO_CONFIRM === 'true') {
            try {
                const confirmCommand = new client_cognito_identity_provider_1.AdminConfirmSignUpCommand({
                    UserPoolId: userPoolId,
                    Username: email,
                });
                await cognitoClient.send(confirmCommand);
            }
            catch (confirmError) {
                console.warn('Auto confirmation failed:', confirmError);
                // エラーを無視（既に確認済みの場合など）
            }
        }
        // データベース接続を初期化
        await (0, secrets_1.initDBFromSecrets)();
        const db = (0, connection_1.getDB)();
        try {
            await db.execute(`INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         name_kanji = VALUES(name_kanji),
         name_kana = VALUES(name_kana),
         tel = VALUES(tel)`, [email, password, name_kanji, name_kana, tel, 1] // role_flag: 1 = 利用者
            );
        }
        catch (dbError) {
            console.error('Database insert error:', dbError);
            // Cognitoユーザーは作成済みなので、DBエラーは警告のみ
            if (dbError.code !== 'ER_DUP_ENTRY') {
                throw dbError;
            }
        }
        // レスポンス
        return (0, response_1.successResponse)({
            userId: email,
            status: signUpResponse.UserSub ? 'success' : 'pending_confirmation',
        }, 201);
    }
    catch (error) {
        console.error('Registration error:', error);
        if (error.name === 'UsernameExistsException') {
            return (0, response_1.errorResponse)('CONFLICT', 'User already exists', 409);
        }
        if (error.name === 'InvalidPasswordException') {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Password does not meet requirements', 400);
        }
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
//# sourceMappingURL=index.js.map