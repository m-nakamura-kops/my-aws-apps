/**
 * 生徒登録Lambda関数（管理者用）
 * POST /v1/admin/students
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getDB } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkAdminPermission } from '../../../../shared/utils/auth';
import * as crypto from 'crypto';

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
    // 管理者権限チェック
    await initDBFromSecrets();
    const permissionCheck = await checkAdminPermission(event);
    if (!permissionCheck.authorized) {
      return errorResponse('FORBIDDEN', permissionCheck.error || 'Admin access required', 403);
    }

    // リクエストボディの解析
    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    const { email, password, name_kanji, name_kana, tel, org_id, remarks } = JSON.parse(event.body);

    // バリデーション
    if (!email || !password || !name_kanji || !name_kana || !tel) {
      return errorResponse(
        'BAD_REQUEST',
        'email, password, name_kanji, name_kana, and tel are required',
        400
      );
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse('BAD_REQUEST', 'Invalid email format', 400);
    }

    // パスワードの強度チェック（最低8文字）
    if (password.length < 8) {
      return errorResponse('BAD_REQUEST', 'Password must be at least 8 characters', 400);
    }

    // データベース接続を取得
    const db = getDB();

    // 既存ユーザーのチェック
    const [existingUsers] = await db.execute(
      'SELECT email FROM users WHERE email = ?',
      [email]
    ) as any[];

    if (existingUsers.length > 0) {
      return errorResponse('CONFLICT', 'User with this email already exists', 409);
    }

    // パスワードのハッシュ化（bcryptの代わりにSHA-256を使用、本番環境ではbcrypt推奨）
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    // データベースにユーザーを登録（role_flag = 1: 利用者/生徒）
    await db.execute(
      `INSERT INTO users (email, password, name_kanji, name_kana, tel, org_id, role_flag, remarks)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [email, hashedPassword, name_kanji, name_kana, tel, org_id || null, remarks || null]
    );

    // Cognitoにユーザーを作成（オプション）
    try {
      if (userPoolId) {
        // Cognitoユーザーを作成
        await cognitoClient.send(new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: email,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
          ],
          MessageAction: 'SUPPRESS', // メール送信を抑制（管理者が作成するため）
        }));

        // パスワードを設定
        await cognitoClient.send(new AdminSetUserPasswordCommand({
          UserPoolId: userPoolId,
          Username: email,
          Password: password,
          Permanent: true,
        }));
      }
    } catch (cognitoError: any) {
      console.error('Cognito user creation error:', cognitoError);
      // Cognitoのエラーは無視して続行（データベースには登録済み）
      // 本番環境では適切なエラーハンドリングが必要
    }

    return successResponse(
      {
        userId: email,
        status: 'success',
        message: 'Student registered successfully',
      },
      201
    );
  } catch (error: any) {
    console.error('Create student error:', error);

    // 重複エラーの処理
    if (error.code === 'ER_DUP_ENTRY') {
      return errorResponse('CONFLICT', 'User with this email already exists', 409);
    }

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
