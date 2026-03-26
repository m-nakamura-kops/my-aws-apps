"use strict";
/**
 * 生徒登録Lambda関数（管理者用）
 * POST /v1/admin/students
 *
 * 管理者はメール・氏名等のみ指定。Cognito の招待メール（仮パスワード）を送信し、
 * DB にはログインに使わないプレースホルダハッシュを保存する。
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
function randomPlaceholderPasswordHash() {
    const raw = crypto.randomBytes(32).toString('hex');
    return crypto.createHash('sha256').update(raw).digest('hex');
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
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const { email, name_kanji, name_kana, tel, org_id, remarks } = JSON.parse(event.body);
        if (!email || !name_kanji || !name_kana || !tel) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'email, name_kanji, name_kana, and tel are required', 400);
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid email format', 400);
        }
        const placeholderHash = randomPlaceholderPasswordHash();
        const pool = (0, connection_1.getDB)();
        const dbResult = await (0, connection_1.withConnection)(pool, async (conn) => {
            const [existingUsers] = (await conn.execute('SELECT email, role_flag FROM users WHERE email = ?', [email]));
            if (existingUsers.length > 0) {
                const rf = existingUsers[0].role_flag;
                if (rf === 2 || rf === 3) {
                    return { ok: false, reason: 'not_student_role' };
                }
                await conn.execute(`UPDATE users SET password = ?, name_kanji = COALESCE(?, name_kanji), name_kana = COALESCE(?, name_kana), tel = COALESCE(?, tel), org_id = COALESCE(?, org_id), remarks = COALESCE(?, remarks) WHERE email = ?`, [placeholderHash, name_kanji || null, name_kana || null, tel || null, org_id || null, remarks || null, email]);
                return { ok: true, existed: true };
            }
            await conn.execute(`INSERT INTO users (email, password, name_kanji, name_kana, tel, org_id, role_flag, remarks)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`, [email, placeholderHash, name_kanji, name_kana, tel, org_id || null, remarks || null]);
            return { ok: true, existed: false };
        });
        if (!dbResult.ok) {
            return (0, response_1.errorResponse)('CONFLICT', 'このメールアドレスはスタッフまたは管理者として既に登録されています', 409);
        }
        let invitationSent = false;
        let cognitoMessage = '';
        try {
            if (userPoolId) {
                try {
                    await cognitoClient.send(new client_cognito_identity_provider_1.AdminCreateUserCommand({
                        UserPoolId: userPoolId,
                        Username: email,
                        UserAttributes: [
                            { Name: 'email', Value: email },
                            { Name: 'email_verified', Value: 'true' },
                            { Name: 'name', Value: (name_kanji || '').trim() || email },
                        ],
                    }));
                    invitationSent = true;
                    cognitoMessage = '招待メールを送信しました（仮パスワード）';
                }
                catch (cognitoError) {
                    if (cognitoError.name === 'UsernameExistsException') {
                        try {
                            await cognitoClient.send(new client_cognito_identity_provider_1.AdminUpdateUserAttributesCommand({
                                UserPoolId: userPoolId,
                                Username: email,
                                UserAttributes: [{ Name: 'name', Value: (name_kanji || '').trim() || email }],
                            }));
                        }
                        catch (attrErr) {
                            console.warn('AdminUpdateUserAttributes before password reset:', attrErr);
                        }
                        await cognitoClient.send(new client_cognito_identity_provider_1.AdminResetUserPasswordCommand({
                            UserPoolId: userPoolId,
                            Username: email,
                        }));
                        invitationSent = true;
                        cognitoMessage = '既存ユーザーにパスワード再設定メールを送信しました';
                    }
                    else {
                        throw cognitoError;
                    }
                }
            }
        }
        catch (cognitoError) {
            console.error('Cognito user creation error:', cognitoError);
            cognitoMessage = cognitoError.message || 'Cognito error';
        }
        return (0, response_1.successResponse)({
            userId: email,
            status: 'success',
            invitationSent,
            message: invitationSent
                ? cognitoMessage || '生徒を登録し、メールを送信しました'
                : userPoolId
                    ? `DB に登録しましたが、Cognito 処理に失敗しました: ${cognitoMessage}`
                    : '生徒を DB に登録しました（User Pool 未設定のためメールは送信されません）',
        }, 201);
    }
    catch (error) {
        console.error('Create student error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return (0, response_1.errorResponse)('CONFLICT', 'User with this email already exists', 409);
        }
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
