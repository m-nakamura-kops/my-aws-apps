/**
 * ユーザー登録Lambda関数
 * POST /v1/users/register
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getDB, withConnection } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import * as crypto from 'crypto';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const userPoolId = process.env.USER_POOL_ID || '';
const cognitoClientId = process.env.COGNITO_CLIENT_ID || '';
const useCognito = !!(userPoolId && cognitoClientId);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // CORSプリフライトリクエスト対応
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    // リクエストボディの解析
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

    // パスワードの強度チェック（最低8文字）
    if (password.length < 8) {
      return errorResponse('BAD_REQUEST', 'Password must be at least 8 characters', 400);
    }

    // メール形式チェック
    if (!EMAIL_REGEX.test(String(email).trim())) {
      return errorResponse('BAD_REQUEST', 'Invalid email format', 400);
    }

    // パスワードのハッシュ化（データベースに保存するため）
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    // Cognitoでユーザー登録（設定がある場合のみ）
    if (useCognito) {
      try {
        const signUpCommand = new SignUpCommand({
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
            const confirmCommand = new AdminConfirmSignUpCommand({
              UserPoolId: userPoolId,
              Username: email,
            });
            await cognitoClient.send(confirmCommand);
          } catch (confirmError) {
            console.warn('Auto confirmation failed:', confirmError);
            // エラーを無視（既に確認済みの場合など）
          }
        }
      } catch (cognitoError: any) {
        console.error('Cognito registration error:', cognitoError);
        if (cognitoError.name === 'UsernameExistsException') {
          return errorResponse('CONFLICT', 'User already exists', 409);
        }
        if (cognitoError.name === 'InvalidPasswordException') {
          return errorResponse('BAD_REQUEST', 'Password does not meet requirements', 400);
        }
        // Cognitoエラーは警告のみ（データベースには登録する）
        console.warn('Cognito registration failed, but continuing with database registration');
      }
    }

    // データベース接続を初期化
    await initDBFromSecrets();
    const pool = getDB();

    const dbResult = await withConnection(pool, async (conn) => {
      const [existing] = (await conn.execute('SELECT email FROM users WHERE email = ?', [email])) as any[];
      if (existing.length > 0) {
        return { ok: false as const, reason: 'exists' as const };
      }
      try {
        await conn.execute(
          `INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [email, hashedPassword, name_kanji, name_kana, tel, 1]
        );
        return { ok: true as const };
      } catch (dbError: any) {
        if (dbError.code === 'ER_DUP_ENTRY') {
          return { ok: false as const, reason: 'dup' as const };
        }
        throw dbError;
      }
    });

    if (!dbResult.ok) {
      return errorResponse('CONFLICT', 'User already exists', 409);
    }

    // レスポンス
    return successResponse({
      userId: email,
      status: useCognito ? 'success' : 'success',
      message: useCognito 
        ? 'User registered successfully' 
        : 'User registered successfully (local development mode)',
    }, 201);
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
