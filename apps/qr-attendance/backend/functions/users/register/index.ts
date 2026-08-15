/**
 * ユーザー登録Lambda関数
 * POST /v1/users/register
 *
 * Cognito と DB(users) の両方に必ずユーザーを作成する。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import {
  deleteCognitoUser,
  ensureCognitoSelfRegisteredUser,
  getCognitoClientId,
  getUserPoolId,
  hashPasswordSha256,
  upsertDbUser,
} from '../../../shared/utils/cognito-db-sync';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    const { email, password, name_kanji, name_kana, tel } = JSON.parse(event.body);

    if (!email || !password || !name_kanji || !name_kana || !tel) {
      return errorResponse(
        'BAD_REQUEST',
        'Email, password, name_kanji, name_kana, and tel are required',
        400
      );
    }

    if (password.length < 8) {
      return errorResponse('BAD_REQUEST', 'Password must be at least 8 characters', 400);
    }

    if (!EMAIL_REGEX.test(String(email).trim())) {
      return errorResponse('BAD_REQUEST', 'Invalid email format', 400);
    }

    const userPoolId = getUserPoolId();
    const cognitoClientId = getCognitoClientId();
    const useCognito = !!(userPoolId && cognitoClientId);

    if (!useCognito) {
      return errorResponse(
        'SERVICE_UNAVAILABLE',
        'Cognito is not configured. Self-registration requires USER_POOL_ID and COGNITO_CLIENT_ID.',
        503
      );
    }

    const normalizedEmail = String(email).trim();
    const hashedPassword = hashPasswordSha256(password);

    // 1) Cognito を先に作成（失敗したら DB も作らない）
    try {
      await ensureCognitoSelfRegisteredUser({
        email: normalizedEmail,
        password,
        name: name_kanji,
      });
    } catch (cognitoError: any) {
      console.error('Cognito registration error:', cognitoError);
      if (cognitoError.name === 'UsernameExistsException') {
        return errorResponse('CONFLICT', 'User already exists', 409);
      }
      if (cognitoError.name === 'InvalidPasswordException') {
        return errorResponse('BAD_REQUEST', 'Password does not meet requirements', 400);
      }
      return errorResponse(
        'INTERNAL_ERROR',
        'Failed to create Cognito user',
        502,
        cognitoError.message
      );
    }

    // 2) DB へ挿入（失敗したら Cognito を補償削除）
    await initDBFromSecrets();
    const pool = getDB();

    try {
      await withConnection(pool, async (conn) => {
        const existing = await conn.execute('SELECT email FROM users WHERE email = ?', [
          normalizedEmail,
        ]);
        const rows = (existing as any[])[0];
        if (rows.length > 0) {
          // Cognito 新規作成済みだが DB 既存 → パスワード等を同期更新
          await upsertDbUser(conn, {
            email: normalizedEmail,
            passwordHash: hashedPassword,
            name_kanji,
            name_kana,
            tel,
            role_flag: 1,
          });
          return;
        }
        await upsertDbUser(conn, {
          email: normalizedEmail,
          passwordHash: hashedPassword,
          name_kanji,
          name_kana,
          tel,
          role_flag: 1,
        });
      });
    } catch (dbError: any) {
      console.error('DB registration failed after Cognito create:', dbError);
      await deleteCognitoUser(normalizedEmail);
      if (dbError.code === 'ER_DUP_ENTRY') {
        return errorResponse('CONFLICT', 'User already exists', 409);
      }
      return errorResponse(
        'INTERNAL_ERROR',
        'Failed to create database user; Cognito user was rolled back',
        500,
        dbError.message
      );
    }

    return successResponse(
      {
        userId: normalizedEmail,
        status: 'success',
        message: 'User registered successfully',
      },
      201
    );
  } catch (error: any) {
    console.error('Registration error:', error);

    if (error.name === 'UsernameExistsException') {
      return errorResponse('CONFLICT', 'User already exists', 409);
    }

    if (error.name === 'InvalidPasswordException') {
      return errorResponse('BAD_REQUEST', 'Password does not meet requirements', 400);
    }

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
