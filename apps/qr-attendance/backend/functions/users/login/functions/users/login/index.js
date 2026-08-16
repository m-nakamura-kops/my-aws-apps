"use strict";
/**
 * ユーザーログインLambda関数
 * POST /v1/users/login
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
        const { email, password } = JSON.parse(event.body);
        if (!email || !password) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Email and password are required', 400);
        }
        // Cognitoで認証
        const authCommand = new client_cognito_identity_provider_1.InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: process.env.COGNITO_CLIENT_ID,
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password,
            },
        });
        const authResponse = await cognitoClient.send(authCommand);
        if (!authResponse.AuthenticationResult) {
            return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid credentials', 401);
        }
        // ユーザー情報を取得
        const getUserCommand = new client_cognito_identity_provider_1.AdminGetUserCommand({
            UserPoolId: userPoolId,
            Username: email,
        });
        const userResponse = await cognitoClient.send(getUserCommand);
        // データベース接続を初期化
        await (0, secrets_1.initDBFromSecrets)();
        const db = (0, connection_1.getDB)();
        const [users] = await db.execute('SELECT email, name_kanji, name_kana, org_id FROM users WHERE email = ?', [email]);
        const userArray = users;
        let userName = email;
        let orgId = null;
        if (userArray.length > 0) {
            userName = userArray[0].name_kanji;
            orgId = userArray[0].org_id;
        }
        // レスポンス
        return (0, response_1.successResponse)({
            token: authResponse.AuthenticationResult.IdToken,
            refreshToken: authResponse.AuthenticationResult.RefreshToken,
            userId: email,
            userName: userName,
            orgId: orgId,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        if (error.name === 'NotAuthorizedException') {
            return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid email or password', 401);
        }
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
//# sourceMappingURL=index.js.map