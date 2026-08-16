"use strict";
/**
 * Cognito と DB(users) の同期ヘルパー
 * 招待・登録・ログインで Cognito のみ / DB のみ の片側欠落を防ぐ。
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
exports.getCognitoClient = getCognitoClient;
exports.getUserPoolId = getUserPoolId;
exports.getCognitoClientId = getCognitoClientId;
exports.isCognitoConfigured = isCognitoConfigured;
exports.randomPlaceholderPasswordHash = randomPlaceholderPasswordHash;
exports.hashPasswordSha256 = hashPasswordSha256;
exports.findDbUser = findDbUser;
exports.upsertDbUser = upsertDbUser;
exports.deleteDbUser = deleteDbUser;
exports.ensureCognitoInvitedUser = ensureCognitoInvitedUser;
exports.deleteCognitoUser = deleteCognitoUser;
exports.ensureCognitoSelfRegisteredUser = ensureCognitoSelfRegisteredUser;
exports.getCognitoUserAttributes = getCognitoUserAttributes;
exports.ensureDbUserFromCognitoAuth = ensureDbUserFromCognitoAuth;
exports.ensureCognitoUserFromDbCredentials = ensureCognitoUserFromDbCredentials;
exports.initiateUserPasswordAuth = initiateUserPasswordAuth;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const crypto = __importStar(require("crypto"));
const region = process.env.AWS_REGION || 'ap-northeast-1';
function getCognitoClient() {
    return new client_cognito_identity_provider_1.CognitoIdentityProviderClient({ region });
}
function getUserPoolId() {
    return process.env.USER_POOL_ID || '';
}
function getCognitoClientId() {
    return process.env.COGNITO_CLIENT_ID || '';
}
function isCognitoConfigured() {
    return Boolean(getUserPoolId());
}
function randomPlaceholderPasswordHash() {
    const raw = crypto.randomBytes(32).toString('hex');
    return crypto.createHash('sha256').update(raw).digest('hex');
}
function hashPasswordSha256(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}
async function findDbUser(conn, email) {
    const [rows] = (await conn.execute('SELECT email, password, name_kanji, name_kana, tel, org_id, role_flag, remarks FROM users WHERE email = ?', [email]));
    return rows[0] || null;
}
async function upsertDbUser(conn, params) {
    const existing = await findDbUser(conn, params.email);
    if (existing) {
        if (params.forceRole && existing.role_flag !== params.role_flag) {
            await conn.execute(`UPDATE users SET role_flag = ?, password = ?, name_kanji = COALESCE(?, name_kanji), name_kana = COALESCE(?, name_kana), tel = COALESCE(?, tel), org_id = COALESCE(?, org_id), remarks = COALESCE(?, remarks) WHERE email = ?`, [
                params.role_flag,
                params.passwordHash,
                params.name_kanji || null,
                params.name_kana || null,
                params.tel || null,
                params.org_id ?? null,
                params.remarks ?? null,
                params.email,
            ]);
        }
        else {
            await conn.execute(`UPDATE users SET password = ?, name_kanji = COALESCE(?, name_kanji), name_kana = COALESCE(?, name_kana), tel = COALESCE(?, tel), org_id = COALESCE(?, org_id), remarks = COALESCE(?, remarks) WHERE email = ?`, [
                params.passwordHash,
                params.name_kanji || null,
                params.name_kana || null,
                params.tel || null,
                params.org_id ?? null,
                params.remarks ?? null,
                params.email,
            ]);
        }
        return { created: false };
    }
    await conn.execute(`INSERT INTO users (email, password, name_kanji, name_kana, tel, org_id, role_flag, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        params.email,
        params.passwordHash,
        params.name_kanji || '',
        params.name_kana || '',
        params.tel || '',
        params.org_id ?? null,
        params.role_flag,
        params.remarks ?? null,
    ]);
    return { created: true };
}
async function deleteDbUser(conn, email) {
    await conn.execute('DELETE FROM users WHERE email = ?', [email]);
}
/**
 * 招待用: Cognito にユーザーを作成（仮パスワードメール送信）。
 * 既存なら属性更新のみ（再招待は呼び出し側で Reset を判断）。
 */
async function ensureCognitoInvitedUser(params) {
    const userPoolId = getUserPoolId();
    if (!userPoolId) {
        throw new Error('USER_POOL_ID is not configured');
    }
    const client = getCognitoClient();
    const displayName = (params.name || '').trim() || params.email;
    try {
        await client.send(new client_cognito_identity_provider_1.AdminCreateUserCommand({
            UserPoolId: userPoolId,
            Username: params.email,
            UserAttributes: [
                { Name: 'email', Value: params.email },
                { Name: 'email_verified', Value: 'true' },
                { Name: 'name', Value: displayName },
            ],
            DesiredDeliveryMediums: ['EMAIL'],
        }));
        return {
            created: true,
            invitationSent: true,
            message: '招待メールを送信しました（仮パスワード）',
        };
    }
    catch (err) {
        if (err?.name !== 'UsernameExistsException') {
            throw err;
        }
        try {
            await client.send(new client_cognito_identity_provider_1.AdminUpdateUserAttributesCommand({
                UserPoolId: userPoolId,
                Username: params.email,
                UserAttributes: [
                    { Name: 'email', Value: params.email },
                    { Name: 'email_verified', Value: 'true' },
                    { Name: 'name', Value: displayName },
                ],
            }));
        }
        catch (attrErr) {
            console.warn('AdminUpdateUserAttributes failed:', attrErr);
        }
        if (params.resendInviteIfExists) {
            // 既存ユーザーへ仮パスワードを再発行して招待メール相当を送る
            await client.send(new client_cognito_identity_provider_1.AdminCreateUserCommand({
                UserPoolId: userPoolId,
                Username: params.email,
                MessageAction: client_cognito_identity_provider_1.MessageActionType.RESEND,
                DesiredDeliveryMediums: ['EMAIL'],
            }));
            return {
                created: false,
                invitationSent: true,
                message: '既存ユーザーに招待メールを再送しました',
            };
        }
        return {
            created: false,
            invitationSent: false,
            message: 'Cognito ユーザーは既に存在します',
        };
    }
}
async function deleteCognitoUser(email) {
    const userPoolId = getUserPoolId();
    if (!userPoolId)
        return;
    const client = getCognitoClient();
    try {
        await client.send(new client_cognito_identity_provider_1.AdminDeleteUserCommand({
            UserPoolId: userPoolId,
            Username: email,
        }));
    }
    catch (err) {
        if (err?.name !== 'UserNotFoundException') {
            console.warn('AdminDeleteUser failed:', err);
        }
    }
}
/** セルフ登録: Cognito SignUp + 必要なら自動確認 */
async function ensureCognitoSelfRegisteredUser(params) {
    const userPoolId = getUserPoolId();
    const clientId = getCognitoClientId();
    if (!userPoolId || !clientId) {
        throw new Error('USER_POOL_ID / COGNITO_CLIENT_ID is not configured');
    }
    const client = getCognitoClient();
    try {
        await client.send(new client_cognito_identity_provider_1.SignUpCommand({
            ClientId: clientId,
            Username: params.email,
            Password: params.password,
            UserAttributes: [
                { Name: 'email', Value: params.email },
                ...(params.name ? [{ Name: 'name', Value: params.name }] : []),
            ],
        }));
    }
    catch (err) {
        if (err?.name === 'UsernameExistsException') {
            throw Object.assign(new Error('User already exists'), { name: 'UsernameExistsException' });
        }
        throw err;
    }
    // 招待フローと同様、メール確認待ちでログイン不能にならないよう確認する
    try {
        await client.send(new client_cognito_identity_provider_1.AdminConfirmSignUpCommand({
            UserPoolId: userPoolId,
            Username: params.email,
        }));
    }
    catch (confirmErr) {
        // 既に確認済み等は無視
        console.warn('AdminConfirmSignUp:', confirmErr?.name || confirmErr);
    }
    try {
        await client.send(new client_cognito_identity_provider_1.AdminUpdateUserAttributesCommand({
            UserPoolId: userPoolId,
            Username: params.email,
            UserAttributes: [{ Name: 'email_verified', Value: 'true' }],
        }));
    }
    catch (attrErr) {
        console.warn('email_verified update failed:', attrErr);
    }
    return { created: true };
}
async function getCognitoUserAttributes(email) {
    const userPoolId = getUserPoolId();
    if (!userPoolId)
        return null;
    const client = getCognitoClient();
    try {
        const res = await client.send(new client_cognito_identity_provider_1.AdminGetUserCommand({
            UserPoolId: userPoolId,
            Username: email,
        }));
        const attrs = {};
        for (const a of res.UserAttributes || []) {
            if (a.Name && a.Value != null)
                attrs[a.Name] = a.Value;
        }
        return attrs;
    }
    catch (err) {
        if (err?.name === 'UserNotFoundException')
            return null;
        throw err;
    }
}
/**
 * Cognito 認証成功後に DB 行が無ければ作成する。
 */
async function ensureDbUserFromCognitoAuth(conn, email, opts) {
    const existing = await findDbUser(conn, email);
    if (existing)
        return existing;
    let name = opts?.name_kanji || '';
    let tel = '';
    try {
        const attrs = await getCognitoUserAttributes(email);
        if (attrs) {
            name = name || attrs.name || attrs.email || email;
            tel = attrs.phone_number || '';
        }
    }
    catch (e) {
        console.warn('getCognitoUserAttributes during DB heal:', e);
    }
    const passwordHash = randomPlaceholderPasswordHash();
    try {
        await conn.execute(`INSERT INTO users (email, password, name_kanji, name_kana, tel, org_id, role_flag, remarks)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`, [
            email,
            passwordHash,
            name || email,
            name || email,
            tel || '00000000000',
            opts?.role_flag ?? 1,
            'auto-synced from Cognito on login',
        ]);
    }
    catch (err) {
        if (err?.code === 'ER_DUP_ENTRY') {
            const again = await findDbUser(conn, email);
            if (again)
                return again;
        }
        throw err;
    }
    const created = await findDbUser(conn, email);
    if (!created) {
        throw new Error('Failed to auto-create DB user from Cognito');
    }
    return created;
}
/**
 * DB のみ存在するユーザー向け: Cognito に恒久パスワードでユーザーを作成する。
 */
async function ensureCognitoUserFromDbCredentials(params) {
    const userPoolId = getUserPoolId();
    if (!userPoolId) {
        throw new Error('USER_POOL_ID is not configured');
    }
    const client = getCognitoClient();
    const displayName = (params.name || '').trim() || params.email;
    const existing = await getCognitoUserAttributes(params.email);
    if (!existing) {
        try {
            await client.send(new client_cognito_identity_provider_1.AdminCreateUserCommand({
                UserPoolId: userPoolId,
                Username: params.email,
                TemporaryPassword: params.password,
                MessageAction: client_cognito_identity_provider_1.MessageActionType.SUPPRESS,
                UserAttributes: [
                    { Name: 'email', Value: params.email },
                    { Name: 'email_verified', Value: 'true' },
                    { Name: 'name', Value: displayName },
                ],
            }));
        }
        catch (err) {
            if (err?.name !== 'UsernameExistsException')
                throw err;
        }
    }
    await client.send(new client_cognito_identity_provider_1.AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: params.email,
        Password: params.password,
        Permanent: true,
    }));
}
async function initiateUserPasswordAuth(email, password) {
    const clientId = getCognitoClientId();
    if (!clientId) {
        throw new Error('COGNITO_CLIENT_ID is not configured');
    }
    const client = getCognitoClient();
    return client.send(new client_cognito_identity_provider_1.InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: {
            USERNAME: email,
            PASSWORD: password,
        },
    }));
}
//# sourceMappingURL=cognito-db-sync.js.map