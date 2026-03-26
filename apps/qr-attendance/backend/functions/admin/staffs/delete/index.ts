/**
 * スタッフアカウント物理削除
 * DELETE /v1/admin/staffs/{email}
 * DB の users 行を削除（関連は CASCADE / 事前に staff_email 参照を除去）。可能なら Cognito ユーザーも削除。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { getDB, withConnection } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkAdminPermission } from '../../../../shared/utils/auth';
import { parseEmailPathParamForDb } from '../../../../shared/utils/parse-path-email';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});
const userPoolId = process.env.USER_POOL_ID || '';

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

    const rawEmail = event.pathParameters?.email;
    const parsed = parseEmailPathParamForDb(rawEmail);
    if (!parsed.ok) {
      console.log(
        JSON.stringify({
          msg: '[admin/staffs/delete] parse failed',
          requestId: event.requestContext?.requestId,
          rawPathParamEmail: rawEmail ?? null,
          reason: parsed.reason,
        })
      );
      return errorResponse(
        'BAD_REQUEST',
        parsed.reason === 'decodeURIComponent_error'
          ? 'Invalid email encoding in path'
          : 'email is required',
        400
      );
    }
    const email = parsed.email;
    console.log(
      JSON.stringify({
        msg: '[admin/staffs/delete] before_sql',
        requestId: event.requestContext?.requestId,
        path: event.path,
        rawPathParamEmail: rawEmail ?? null,
        emailForSql: email,
        emailUtf8Hex: Buffer.from(email, 'utf8').toString('hex'),
      })
    );
    if (permissionCheck.email && permissionCheck.email.toLowerCase() === email.toLowerCase()) {
      return errorResponse('FORBIDDEN', '自分自身のアカウントは削除できません', 403);
    }

    const pool = getDB();
    const outcome = await withConnection(pool, async (conn) => {
      const [existingUsers] = (await conn.execute(
        'SELECT email, role_flag FROM users WHERE email = ?',
        [email]
      )) as any[];

      if (existingUsers.length === 0) {
        return { err: 'not_found' as const };
      }

      const role = existingUsers[0].role_flag;
      if (role !== 2 && role !== 3) {
        return { err: 'not_staff' as const };
      }

      // staff_email は ON DELETE RESTRICT のため先に除去
      await conn.execute('DELETE FROM attendance_logs WHERE staff_email = ?', [email]);
      await conn.execute('DELETE FROM users WHERE email = ?', [email]);

      return { err: null };
    });

    if (outcome.err === 'not_found') {
      return errorResponse('NOT_FOUND', 'Staff not found', 404);
    }
    if (outcome.err === 'not_staff') {
      return errorResponse('BAD_REQUEST', 'User is not a staff or admin', 400);
    }

    let cognito_deleted = false;
    let cognito_error: string | undefined;
    if (userPoolId) {
      try {
        await cognitoClient.send(
          new AdminDeleteUserCommand({
            UserPoolId: userPoolId,
            Username: email,
          })
        );
        cognito_deleted = true;
      } catch (e: any) {
        if (e.name === 'UserNotFoundException') {
          cognito_deleted = false;
        } else {
          cognito_error = e.message || String(e);
          console.error('Cognito AdminDeleteUser error:', e);
        }
      }
    }

    return successResponse({
      message: 'アカウントを削除しました',
      email,
      cognito_deleted,
      ...(cognito_error ? { cognito_error } : {}),
    });
  } catch (error: any) {
    console.error('Delete staff error:', error);
    return errorResponse('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
  }
};
