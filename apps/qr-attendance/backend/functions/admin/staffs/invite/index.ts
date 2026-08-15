/**
 * スタッフ招待Lambda関数
 * POST /v1/admin/invite
 *
 * Cognito 招待と DB(users) への role_flag=2 登録をセットで保証する。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkAdminPermission } from '../../../../shared/utils/auth';
import {
  deleteDbUser,
  ensureCognitoInvitedUser,
  isCognitoConfigured,
  randomPlaceholderPasswordHash,
  upsertDbUser,
} from '../../../../shared/utils/cognito-db-sync';

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

    if (!isCognitoConfigured()) {
      return errorResponse(
        'SERVICE_UNAVAILABLE',
        'USER_POOL_ID is not configured. Cannot invite staff without Cognito.',
        503
      );
    }

    const placeholderHash = randomPlaceholderPasswordHash();
    const pool = getDB();

    const dbPrep = await withConnection(pool, async (conn) => {
      const upsert = await upsertDbUser(conn, {
        email,
        passwordHash: placeholderHash,
        name_kanji: name_kanji || '',
        name_kana: name_kana || '',
        tel: tel || '',
        org_id: org_id || null,
        remarks: remarks || null,
        role_flag: 2,
        forceRole: true,
      });
      return { created: upsert.created };
    });

    try {
      const cognitoResult = await ensureCognitoInvitedUser({
        email,
        name: name_kanji,
        resendInviteIfExists: true,
      });

      return successResponse({
        status: 'success',
        invitationSent: cognitoResult.invitationSent,
        cognitoCreated: cognitoResult.created,
        dbCreated: dbPrep.created,
        email,
        message: cognitoResult.message || 'スタッフを登録し、招待メールを送信しました',
      });
    } catch (cognitoError: any) {
      console.error('Cognito invite failed after DB upsert:', cognitoError);
      if (dbPrep.created) {
        try {
          await withConnection(pool, async (conn) => deleteDbUser(conn, email));
        } catch (rollbackErr) {
          console.error('DB rollback after Cognito failure failed:', rollbackErr);
        }
      }
      return errorResponse(
        'INTERNAL_ERROR',
        'Cognito への招待ユーザー作成に失敗したため、登録を中止しました',
        502,
        cognitoError?.message
      );
    }
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
