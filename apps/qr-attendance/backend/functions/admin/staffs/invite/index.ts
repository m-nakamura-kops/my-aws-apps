/**
 * スタッフ招待Lambda関数
 * POST /v1/admin/invite
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';
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
    if (!email) {
      return errorResponse('BAD_REQUEST', 'email is required', 400);
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse('BAD_REQUEST', 'Invalid email format', 400);
    }

    // データベース接続を取得
    const db = getDB();

    // 既存ユーザーのチェック
    const [existingUsers] = await db.execute(
      'SELECT email, role_flag FROM users WHERE email = ?',
      [email]
    ) as any[];

    // パスワード生成（指定されていない場合）
    let generatedPassword = password;
    if (!generatedPassword) {
      // ランダムパスワードを生成（12文字）
      generatedPassword = crypto.randomBytes(8).toString('base64').slice(0, 12);
    }

    // パスワードの強度チェック（最低8文字）
    if (generatedPassword.length < 8) {
      return errorResponse('BAD_REQUEST', 'Password must be at least 8 characters', 400);
    }

    // パスワードのハッシュ化
    const hashedPassword = crypto.createHash('sha256').update(generatedPassword).digest('hex');

    if (existingUsers.length > 0) {
      // 既存ユーザーの場合、role_flagを2（スタッフ）に更新
      if (existingUsers[0].role_flag !== 2) {
        await db.execute(
          `UPDATE users SET role_flag = 2, password = ?, name_kanji = COALESCE(?, name_kanji), name_kana = COALESCE(?, name_kana), tel = COALESCE(?, tel), org_id = COALESCE(?, org_id), remarks = COALESCE(?, remarks) WHERE email = ?`,
          [hashedPassword, name_kanji || null, name_kana || null, tel || null, org_id || null, remarks || null, email]
        );
      }
    } else {
      // 新規ユーザーの場合、スタッフとして登録
      await db.execute(
        `INSERT INTO users (email, password, name_kanji, name_kana, tel, org_id, role_flag, remarks)
         VALUES (?, ?, ?, ?, ?, ?, 2, ?)`,
        [email, hashedPassword, name_kanji || '', name_kana || '', tel || '', org_id || null, remarks || null]
      );
    }

    // Cognitoにユーザーを作成または更新
    let invitationSent = false;
    try {
      if (userPoolId) {
        try {
          // Cognitoユーザーを作成
          await cognitoClient.send(new AdminCreateUserCommand({
            UserPoolId: userPoolId,
            Username: email,
            UserAttributes: [
              { Name: 'email', Value: email },
              { Name: 'email_verified', Value: 'true' },
            ],
            MessageAction: 'SUPPRESS', // メール送信を抑制
            TemporaryPassword: generatedPassword,
          }));

          // パスワードを設定
          await cognitoClient.send(new AdminSetUserPasswordCommand({
            UserPoolId: userPoolId,
            Username: email,
            Password: generatedPassword,
            Permanent: true,
          }));

          invitationSent = true;
        } catch (cognitoError: any) {
          if (cognitoError.name === 'UsernameExistsException') {
            // 既存ユーザーの場合、パスワードを更新
            await cognitoClient.send(new AdminSetUserPasswordCommand({
              UserPoolId: userPoolId,
              Username: email,
              Password: generatedPassword,
              Permanent: true,
            }));
            invitationSent = true;
          } else {
            throw cognitoError;
          }
        }
      }
    } catch (cognitoError: any) {
      console.error('Cognito user creation error:', cognitoError);
      // Cognitoのエラーは無視して続行（データベースには登録済み）
    }

    return successResponse({
      status: 'success',
      invitationSent,
      email,
      message: invitationSent 
        ? 'Staff invited successfully. Password has been set.' 
        : 'Staff registered in database. Cognito invitation failed.',
    });
  } catch (error: any) {
    console.error('Invite staff error:', error);

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
