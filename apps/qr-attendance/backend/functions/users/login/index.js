"use strict";
/**
 * ユーザーログインLambda関数
 * POST /v1/users/login
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
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const connection_1 = require("./shared/db/connection");
const secrets_1 = require("./shared/db/secrets");
const response_1 = require("./shared/utils/response");
const crypto = __importStar(require("crypto"));
const cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const userPoolId = process.env.USER_POOL_ID || '';
const cognitoClientId = process.env.COGNITO_CLIENT_ID || '';
const useCognito = !!(userPoolId && cognitoClientId);
const handler = async (event) => {
    // CORSプリフライトリクエスト対応
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    // モジュール読み込み時の Cognito 利用判定（Lambda 環境変数が空だと DB ハッシュ比較に落ちる）
    console.log('[login] useCognito=', useCognito, {
        USER_POOL_ID_set: Boolean(userPoolId),
        COGNITO_CLIENT_ID_set: Boolean(cognitoClientId),
    });
    try {
        // リクエストボディの解析
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        let email;
        let password;
        try {
            const body = JSON.parse(event.body);
            email = body?.email ?? '';
            password = body?.password ?? '';
        }
        catch {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid JSON body', 400);
        }
        if (!email || !password) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Email and password are required', 400);
        }
        // データベース接続を初期化
        await (0, secrets_1.initDBFromSecrets)();
        const pool = (0, connection_1.getDB)();
        // ユーザー情報を取得（is_active カラム未導入の DB でも動作するよう SELECT に含めない）
        const [users] = (await (0, connection_1.withConnection)(pool, async (conn) => conn.execute('SELECT email, password, name_kanji, name_kana, org_id, role_flag FROM users WHERE email = ?', [email])));
        if (users.length === 0) {
            console.log('[login] DB: no row for email=', email, '(seed-test-users がこの RDS に届いていない可能性)');
            return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid email or password', 401);
        }
        const user = users[0];
        // パスワード値はログに出さず、デバッグ用に行の存在と role のみ
        console.log('User found in DB:', {
            email: user.email,
            name_kanji: user.name_kanji,
            org_id: user.org_id,
            role_flag: user.role_flag,
            password_stored_length: user.password != null ? String(user.password).length : 0,
        });
        // 認証処理
        let authToken = '';
        let refreshToken = '';
        if (useCognito) {
            // Cognito認証を使用（本番環境）
            try {
                const authCommand = new client_cognito_identity_provider_1.InitiateAuthCommand({
                    AuthFlow: 'USER_PASSWORD_AUTH',
                    ClientId: cognitoClientId,
                    AuthParameters: {
                        USERNAME: email,
                        PASSWORD: password,
                    },
                });
                const authResponse = await cognitoClient.send(authCommand);
                if (authResponse.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
                    return (0, response_1.successResponse)({
                        challengeName: 'NEW_PASSWORD_REQUIRED',
                        session: authResponse.Session,
                        email,
                        userName: user.name_kanji || email,
                        roleFlag: user.role_flag || 1,
                    });
                }
                if (!authResponse.AuthenticationResult) {
                    return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid credentials', 401);
                }
                authToken = authResponse.AuthenticationResult.IdToken || '';
                refreshToken = authResponse.AuthenticationResult.RefreshToken || '';
            }
            catch (cognitoError) {
                console.error('Cognito authentication error:', cognitoError);
                if (cognitoError.name === 'NotAuthorizedException' || cognitoError.name === 'UserNotFoundException') {
                    return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid email or password', 401);
                }
                throw cognitoError;
            }
        }
        else {
            // ローカル開発環境: データベースのパスワードで認証
            // パスワードのハッシュ化（SHA-256を使用、本番環境ではbcrypt推奨）
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            if (user.password !== hashedPassword) {
                return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid email or password', 401);
            }
            // ローカル開発用の簡易トークン生成（本番環境ではJWTを使用）
            const jwtSecret = process.env.JWT_SECRET || 'local-dev-secret';
            const tokenPayload = {
                email: user.email,
                roleFlag: user.role_flag,
                exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24時間有効
            };
            authToken = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
            refreshToken = Buffer.from(JSON.stringify({ ...tokenPayload, type: 'refresh' })).toString('base64');
        }
        // レスポンス
        return (0, response_1.successResponse)({
            token: authToken,
            refreshToken: refreshToken,
            userId: email,
            userName: user.name_kanji || email,
            orgId: user.org_id,
            roleFlag: user.role_flag || 1,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        // Cognito認証エラーの処理
        if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') {
            return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid email or password', 401);
        }
        // DB接続エラー（ローカルでMySQL未起動・Too many connections等）
        const code = error?.code ?? error?.errno;
        const msg = error?.message ?? '';
        if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'ER_ACCESS_DENIED_ERROR') {
            return (0, response_1.errorResponse)('SERVICE_UNAVAILABLE', 'Database connection failed. Ensure MySQL is running and DB_HOST/DB_USER/DB_PASSWORD/DB_NAME are set.', 503, error.message);
        }
        if (code === 'ER_CON_COUNT_ERROR' || (typeof msg === 'string' && msg.includes('Too many connections'))) {
            return (0, response_1.errorResponse)('SERVICE_UNAVAILABLE', 'Database is busy (too many connections). Please retry in a moment.', 503, error.message);
        }
        // その他のエラー
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
//# sourceMappingURL=index.js.map