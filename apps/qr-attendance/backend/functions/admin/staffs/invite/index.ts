/**
 * スタッフ招待Lambda関数
 * POST /v1/admin/invite
 *
 * 管理者はメール等のみ指定。Cognito の招待メール（仮パスワード）を送信し、
 * DB にはログインに使わないプレースホルダハッシュを保存する。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminResetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { getDB, withConnection } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkAdminPermission } from '../../../../shared/utils/auth';
import * as crypto from 'crypto';

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const userPoolId = process.env.USER_POOL_ID || '';

/** Cognito 認証のみを使うため、DB には推測不能なダミーハッシュを入れる */
function randomPlaceholderPasswordHash(): string {
  const raw = crypto.randomBytes(32).toString('hex');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    await initDBFromSecrets();
    const permissionCheck = await checkAdminPermission(event);
    if (!permissionCheck.authorized) {
      return errorResponse('FORBIDDEN', permissionCheck.error || 'Admin access required', 403);
    }

    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    const { email, name_kanji, name_kana, tel, org_id, remarks } = JSON.parse(event.body);

    if (!email) {
      return errorResponse('BAD_REQUEST', 'email is required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse('BAD_REQUEST', 'Invalid email format', 400);
    }

    const placeholderHash = randomPlaceholderPasswordHash();

    const pool = getDB();
    await withConnection(pool, async (conn) => {
      const [existingUsers] = (await conn.execute(
        'SELECT email, role_flag FROM users WHERE email = ?',
        [email]
      )) as any[];

      if (existingUsers.length > 0) {
        if (existingUsers[0].role_flag !== 2) {
          await conn.execute(
            `UPDATE users SET role_flag = 2, password = ?, name_kanji = COALESCE(?, name_kanji), name_kana = COALESCE(?, name_kana), tel = COALESCE(?, tel), org_id = COALESCE(?, org_id), remarks = COALESCE(?, remarks) WHERE email = ?`,
            [placeholderHash, name_kanji || null, name_kana || null, tel || null, org_id || null, remarks || null, email]
          );
        }
      } else {
        await conn.execute(
          `INSERT INTO users (email, password, name_kanji, name_kana, tel, org_id, role_flag, remarks)
         VALUES (?, ?, ?, ?, ?, ?, 2, ?)`,
          [email, placeholderHash, name_kanji || '', name_kana || '', tel || '', org_id || null, remarks || null]
        );
      }
    });

    let invitationSent = false;
    let cognitoMessage = '';

    try {
      if (userPoolId) {
        try {
          await cognitoClient.send(
            new AdminCreateUserCommand({
              UserPoolId: userPoolId,
              Username: email,
              UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'email_verified', Value: 'true' },
                { Name: 'name', Value: (name_kanji || '').trim() || email },
              ],
              // TemporaryPassword 省略 → Cognito が生成し、招待メールで通知（MessageAction 既定）
            })
          );
          invitationSent = true;
          cognitoMessage = '招待メールを送信しました（仮パスワード）';
        } catch (cognitoError: any) {
          if (cognitoError.name === 'UsernameExistsException') {
            try {
              await cognitoClient.send(
                new AdminUpdateUserAttributesCommand({
                  UserPoolId: userPoolId,
                  Username: email,
                  UserAttributes: [{ Name: 'name', Value: (name_kanji || '').trim() || email }],
                })
              );
            } catch (attrErr) {
              console.warn('AdminUpdateUserAttributes before password reset:', attrErr);
            }
            await cognitoClient.send(
              new AdminResetUserPasswordCommand({
                UserPoolId: userPoolId,
                Username: email,
              })
            );
            invitationSent = true;
            cognitoMessage = '既存ユーザーにパスワード再設定メールを送信しました';
          } else {
            throw cognitoError;
          }
        }
      }
    } catch (cognitoError: any) {
      console.error('Cognito user creation error:', cognitoError);
      cognitoMessage = cognitoError.message || 'Cognito error';
    }

    return successResponse({
      status: 'success',
      invitationSent,
      email,
      message: invitationSent
        ? cognitoMessage || 'スタッフを登録し、メールを送信しました'
        : userPoolId
          ? `DB に登録しましたが、Cognito 処理に失敗しました: ${cognitoMessage}`
          : 'スタッフを DB に登録しました（User Pool 未設定のためメールは送信されません）',
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
