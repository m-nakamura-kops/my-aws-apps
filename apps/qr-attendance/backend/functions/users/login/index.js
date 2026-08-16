"use strict";
/**
 * ユーザーログインLambda関数
 * POST /v1/users/login
 *
 * Cognito 認証を正とし、DB 欠落時は Cognito 情報から自動補完する。
 * 逆に DB のみ存在する場合は Cognito ユーザーを自動作成してから認証する。
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
const connection_1 = require("./shared/db/connection");
const secrets_1 = require("./shared/db/secrets");
const response_1 = require("./shared/utils/response");
const cognito_db_sync_1 = require("./shared/utils/cognito-db-sync");
const crypto = __importStar(require("crypto"));
const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    const userPoolId = (0, cognito_db_sync_1.getUserPoolId)();
    const cognitoClientId = (0, cognito_db_sync_1.getCognitoClientId)();
    const useCognito = !!(userPoolId && cognitoClientId);
    console.log('[login] useCognito=', useCognito, {
        USER_POOL_ID_set: Boolean(userPoolId),
        COGNITO_CLIENT_ID_set: Boolean(cognitoClientId),
    });
    try {
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        let email;
        let password;
        try {
            const body = JSON.parse(event.body);
            email = String(body?.email ?? '').trim();
            password = body?.password ?? '';
        }
        catch {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid JSON body', 400);
        }
        if (!email || !password) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Email and password are required', 400);
        }
        await (0, secrets_1.initDBFromSecrets)();
        const pool = (0, connection_1.getDB)();
        let authToken = '';
        let refreshToken = '';
        let user = await (0, connection_1.withConnection)(pool, async (conn) => (0, cognito_db_sync_1.findDbUser)(conn, email));
        if (useCognito) {
            try {
                let authResponse = await (0, cognito_db_sync_1.initiateUserPasswordAuth)(email, password);
                if (authResponse.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
                    if (!user) {
                        user = await (0, connection_1.withConnection)(pool, async (conn) => (0, cognito_db_sync_1.ensureDbUserFromCognitoAuth)(conn, email, { role_flag: 1 }));
                    }
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
                // Cognito 成功 → DB が無ければ自動作成
                if (!user) {
                    console.log('[login] Cognito OK but DB missing; auto-creating users row for', email);
                    user = await (0, connection_1.withConnection)(pool, async (conn) => (0, cognito_db_sync_1.ensureDbUserFromCognitoAuth)(conn, email, { role_flag: 1 }));
                }
            }
            catch (cognitoError) {
                console.error('Cognito authentication error:', cognitoError);
                // Cognito に居ない / パスワード不一致だが、DB のハッシュが一致する場合は Cognito を補完
                if (cognitoError.name === 'UserNotFoundException' ||
                    cognitoError.name === 'NotAuthorizedException') {
                    if (!user) {
                        return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid email or password', 401);
                    }
                    const hashedPassword = (0, cognito_db_sync_1.hashPasswordSha256)(password);
                    const dbPasswordMatches = user.password === hashedPassword;
                    if (!dbPasswordMatches) {
                        // 招待ユーザー（DB はプレースホルダ）で Cognito 未作成のケースは
                        // 任意パスワードでの Cognito 作成を許さない
                        return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid email or password', 401);
                    }
                    try {
                        console.log('[login] healing Cognito from DB credentials for', email);
                        await (0, cognito_db_sync_1.ensureCognitoUserFromDbCredentials)({
                            email,
                            password,
                            name: user.name_kanji || email,
                        });
                        const retry = await (0, cognito_db_sync_1.initiateUserPasswordAuth)(email, password);
                        if (retry.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
                            return (0, response_1.successResponse)({
                                challengeName: 'NEW_PASSWORD_REQUIRED',
                                session: retry.Session,
                                email,
                                userName: user.name_kanji || email,
                                roleFlag: user.role_flag || 1,
                            });
                        }
                        if (!retry.AuthenticationResult) {
                            return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid email or password', 401);
                        }
                        authToken = retry.AuthenticationResult.IdToken || '';
                        refreshToken = retry.AuthenticationResult.RefreshToken || '';
                    }
                    catch (healErr) {
                        console.error('[login] Cognito heal failed:', healErr);
                        return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid email or password', 401);
                    }
                }
                else {
                    throw cognitoError;
                }
            }
        }
        else {
            // ローカル開発: DB ハッシュ比較
            if (!user) {
                return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid email or password', 401);
            }
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            if (user.password !== hashedPassword) {
                return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid email or password', 401);
            }
            const tokenPayload = {
                email: user.email,
                roleFlag: user.role_flag,
                exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
            };
            authToken = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
            refreshToken = Buffer.from(JSON.stringify({ ...tokenPayload, type: 'refresh' })).toString('base64');
        }
        if (!user) {
            return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid email or password', 401);
        }
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
        if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') {
            return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid email or password', 401);
        }
        const code = error?.code ?? error?.errno;
        const msg = error?.message ?? '';
        if (code === 'ECONNREFUSED' ||
            code === 'ENOTFOUND' ||
            code === 'ETIMEDOUT' ||
            code === 'ER_ACCESS_DENIED_ERROR') {
            return (0, response_1.errorResponse)('SERVICE_UNAVAILABLE', 'Database connection failed. Ensure MySQL is running and DB_HOST/DB_USER/DB_PASSWORD/DB_NAME are set.', 503, error.message);
        }
        if (code === 'ER_CON_COUNT_ERROR' ||
            (typeof msg === 'string' && msg.includes('Too many connections'))) {
            return (0, response_1.errorResponse)('SERVICE_UNAVAILABLE', 'Database is busy (too many connections). Please retry in a moment.', 503, error.message);
        }
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
//# sourceMappingURL=index.js.map