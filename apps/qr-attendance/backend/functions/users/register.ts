/**
 * ユーザー登録Lambda関数
 * POST /v1/users/register
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getDB, withConnection } from '../../shared/db/connection';
import { initDBFromSecrets } from '../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../shared/utils/response';

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const userPoolId = process.env.USER_POOL_ID || '';

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

    // Cognitoでユーザー登録
    const signUpCommand = new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
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

    // データベース接続を初期化
    await initDBFromSecrets();
    const pool = getDB();
    try {
      await withConnection(pool, async (conn) =>
        conn.execute(
          `INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         name_kanji = VALUES(name_kanji),
         name_kana = VALUES(name_kana),
         tel = VALUES(tel)`,
          [email, password, name_kanji, name_kana, tel, 1]
        )
      );
    } catch (dbError: any) {
      console.error('Database insert error:', dbError);
      // Cognitoユーザーは作成済みなので、DBエラーは警告のみ
      if (dbError.code !== 'ER_DUP_ENTRY') {
        throw dbError;
      }
    }

    // レスポンス
    return successResponse({
      userId: email,
      status: signUpResponse.UserSub ? 'success' : 'pending_confirmation',
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
