"use strict";
/**
 * ユーザー登録Lambda関数
 * POST /v1/users/register
 *
 * Cognito と DB(users) の両方に必ずユーザーを作成する。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require("./shared/db/connection");
const secrets_1 = require("./shared/db/secrets");
const response_1 = require("./shared/utils/response");
const cognito_db_sync_1 = require("./shared/utils/cognito-db-sync");
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const { email, password, name_kanji, name_kana, tel } = JSON.parse(event.body);
        if (!email || !password || !name_kanji || !name_kana || !tel) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Email, password, name_kanji, name_kana, and tel are required', 400);
        }
        if (password.length < 8) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Password must be at least 8 characters', 400);
        }
        if (!EMAIL_REGEX.test(String(email).trim())) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid email format', 400);
        }
        const userPoolId = (0, cognito_db_sync_1.getUserPoolId)();
        const cognitoClientId = (0, cognito_db_sync_1.getCognitoClientId)();
        const useCognito = !!(userPoolId && cognitoClientId);
        if (!useCognito) {
            return (0, response_1.errorResponse)('SERVICE_UNAVAILABLE', 'Cognito is not configured. Self-registration requires USER_POOL_ID and COGNITO_CLIENT_ID.', 503);
        }
        const normalizedEmail = String(email).trim();
        const hashedPassword = (0, cognito_db_sync_1.hashPasswordSha256)(password);
        // 1) Cognito を先に作成（失敗したら DB も作らない）
        try {
            await (0, cognito_db_sync_1.ensureCognitoSelfRegisteredUser)({
                email: normalizedEmail,
                password,
                name: name_kanji,
            });
        }
        catch (cognitoError) {
            console.error('Cognito registration error:', cognitoError);
            if (cognitoError.name === 'UsernameExistsException') {
                return (0, response_1.errorResponse)('CONFLICT', 'User already exists', 409);
            }
            if (cognitoError.name === 'InvalidPasswordException') {
                return (0, response_1.errorResponse)('BAD_REQUEST', 'Password does not meet requirements', 400);
            }
            return (0, response_1.errorResponse)('INTERNAL_ERROR', 'Failed to create Cognito user', 502, cognitoError.message);
        }
        // 2) DB へ挿入（失敗したら Cognito を補償削除）
        await (0, secrets_1.initDBFromSecrets)();
        const pool = (0, connection_1.getDB)();
        try {
            await (0, connection_1.withConnection)(pool, async (conn) => {
                const existing = await conn.execute('SELECT email FROM users WHERE email = ?', [
                    normalizedEmail,
                ]);
                const rows = existing[0];
                if (rows.length > 0) {
                    // Cognito 新規作成済みだが DB 既存 → パスワード等を同期更新
                    await (0, cognito_db_sync_1.upsertDbUser)(conn, {
                        email: normalizedEmail,
                        passwordHash: hashedPassword,
                        name_kanji,
                        name_kana,
                        tel,
                        role_flag: 1,
                    });
                    return;
                }
                await (0, cognito_db_sync_1.upsertDbUser)(conn, {
                    email: normalizedEmail,
                    passwordHash: hashedPassword,
                    name_kanji,
                    name_kana,
                    tel,
                    role_flag: 1,
                });
            });
        }
        catch (dbError) {
            console.error('DB registration failed after Cognito create:', dbError);
            await (0, cognito_db_sync_1.deleteCognitoUser)(normalizedEmail);
            if (dbError.code === 'ER_DUP_ENTRY') {
                return (0, response_1.errorResponse)('CONFLICT', 'User already exists', 409);
            }
            return (0, response_1.errorResponse)('INTERNAL_ERROR', 'Failed to create database user; Cognito user was rolled back', 500, dbError.message);
        }
        return (0, response_1.successResponse)({
            userId: normalizedEmail,
            status: 'success',
            message: 'User registered successfully',
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