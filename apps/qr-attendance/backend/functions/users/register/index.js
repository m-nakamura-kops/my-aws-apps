"use strict";
/**
 * ユーザー登録Lambda関数
 * POST /v1/users/register
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
    try {
        // リクエストボディの解析
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const { email, password, name_kanji, name_kana, tel } = JSON.parse(event.body);
        if (!email || !password || !name_kanji || !name_kana || !tel) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Email, password, name_kanji, name_kana, and tel are required', 400);
        }
        // パスワードの強度チェック（最低8文字）
        if (password.length < 8) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Password must be at least 8 characters', 400);
        }
        // メール形式チェック（@ とドメイン必須）
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(email).trim())) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid email format', 400);
        }
        // パスワードのハッシュ化（データベースに保存するため）
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        // Cognitoでユーザー登録（設定がある場合のみ）
        if (useCognito) {
            try {
                const signUpCommand = new client_cognito_identity_provider_1.SignUpCommand({
                    ClientId: cognitoClientId,
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
            }
            catch (cognitoError) {
                console.error('Cognito registration error:', cognitoError);
                if (cognitoError.name === 'UsernameExistsException') {
                    return (0, response_1.errorResponse)('CONFLICT', 'User already exists', 409);
                }
                if (cognitoError.name === 'InvalidPasswordException') {
                    return (0, response_1.errorResponse)('BAD_REQUEST', 'Password does not meet requirements', 400);
                }
                // Cognitoエラーは警告のみ（データベースには登録する）
                console.warn('Cognito registration failed, but continuing with database registration');
            }
        }
        // データベース接続を初期化
        await (0, secrets_1.initDBFromSecrets)();
        const db = (0, connection_1.getDB)();
        // 重複チェック: 既に登録済みの場合は 409 を返す（上書きしない）
        const [existing] = await db.execute('SELECT email FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return (0, response_1.errorResponse)('CONFLICT', 'User already exists', 409);
        }
        try {
            await db.execute(`INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag)
         VALUES (?, ?, ?, ?, ?, ?)`, [email, hashedPassword, name_kanji, name_kana, tel, 1] // role_flag: 1 = 利用者
            );
        }
        catch (dbError) {
            console.error('Database insert error:', dbError);
            if (dbError.code === 'ER_DUP_ENTRY') {
                return (0, response_1.errorResponse)('CONFLICT', 'User already exists', 409);
            }
            throw dbError;
        }
        // レスポンス
        return (0, response_1.successResponse)({
            userId: email,
            status: useCognito ? 'success' : 'success',
            message: useCognito
                ? 'User registered successfully'
                : 'User registered successfully (local development mode)',
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