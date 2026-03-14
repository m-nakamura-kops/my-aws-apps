"use strict";
/**
 * 生徒登録Lambda関数（管理者用）
 * POST /v1/admin/students
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
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const crypto = __importStar(require("crypto"));
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
        // リクエストボディの解析
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const { email, password, name_kanji, name_kana, tel, org_id, remarks } = JSON.parse(event.body);
        // バリデーション
        if (!email || !password || !name_kanji || !name_kana || !tel) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'email, password, name_kanji, name_kana, and tel are required', 400);
        }
        // メールアドレスの形式チェック
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid email format', 400);
        }
        // パスワードの強度チェック（最低8文字）
        if (password.length < 8) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Password must be at least 8 characters', 400);
        }
        // データベース接続を取得
        const db = (0, connection_1.getDB)();
        // 既存ユーザーのチェック
        const [existingUsers] = await db.execute('SELECT email FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return (0, response_1.errorResponse)('CONFLICT', 'User with this email already exists', 409);
        }
        // パスワードのハッシュ化（bcryptの代わりにSHA-256を使用、本番環境ではbcrypt推奨）
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        // データベースにユーザーを登録（role_flag = 1: 利用者/生徒）
        await db.execute(`INSERT INTO users (email, password, name_kanji, name_kana, tel, org_id, role_flag, remarks)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`, [email, hashedPassword, name_kanji, name_kana, tel, org_id || null, remarks || null]);
        // Cognitoにユーザーを作成（オプション）
        try {
            if (userPoolId) {
                // Cognitoユーザーを作成
                await cognitoClient.send(new client_cognito_identity_provider_1.AdminCreateUserCommand({
                    UserPoolId: userPoolId,
                    Username: email,
                    UserAttributes: [
                        { Name: 'email', Value: email },
                        { Name: 'email_verified', Value: 'true' },
                    ],
                    MessageAction: 'SUPPRESS', // メール送信を抑制（管理者が作成するため）
                }));
                // パスワードを設定
                await cognitoClient.send(new client_cognito_identity_provider_1.AdminSetUserPasswordCommand({
                    UserPoolId: userPoolId,
                    Username: email,
                    Password: password,
                    Permanent: true,
                }));
            }
        }
        catch (cognitoError) {
            console.error('Cognito user creation error:', cognitoError);
            // Cognitoのエラーは無視して続行（データベースには登録済み）
            // 本番環境では適切なエラーハンドリングが必要
        }
        return (0, response_1.successResponse)({
            userId: email,
            status: 'success',
            message: 'Student registered successfully',
        }, 201);
    }
    catch (error) {
        console.error('Create student error:', error);
        // 重複エラーの処理
        if (error.code === 'ER_DUP_ENTRY') {
            return (0, response_1.errorResponse)('CONFLICT', 'User with this email already exists', 409);
        }
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
