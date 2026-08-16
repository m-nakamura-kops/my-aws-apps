/**
 * 生徒登録Lambda関数（管理者用）
 * POST /v1/admin/students
 *
 * Cognito 招待ユーザー作成と DB(users) 挿入をセットで行い、
 * 片側だけの成功状態を残さない。
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

    if (!email || !name_kanji || !name_kana || !tel) {
      return errorResponse('BAD_REQUEST', 'email, name_kanji, name_kana, and tel are required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse('BAD_REQUEST', 'Invalid email format', 400);
    }

    if (!isCognitoConfigured()) {
      return errorResponse(
        'SERVICE_UNAVAILABLE',
        'USER_POOL_ID is not configured. Cannot invite students without Cognito.',
        503
      );
    }

    const placeholderHash = randomPlaceholderPasswordHash();
    const pool = getDB();

    const dbPrep = await withConnection(pool, async (conn) => {
      const [existingUsers] = (await conn.execute(
        'SELECT email, role_flag FROM users WHERE email = ?',
        [email]
      )) as any[];

      if (existingUsers.length > 0) {
        const rf = existingUsers[0].role_flag;
        if (rf === 2 || rf === 3) {
          return { ok: false as const, reason: 'not_student_role' as const };
        }
      }

      const upsert = await upsertDbUser(conn, {
        email,
        passwordHash: placeholderHash,
        name_kanji,
        name_kana,
        tel,
        org_id: org_id || null,
        remarks: remarks || null,
        role_flag: 1,
      });
      return { ok: true as const, created: upsert.created };
    });

    if (!dbPrep.ok) {
      return errorResponse(
        'CONFLICT',
        'このメールアドレスはスタッフまたは管理者として既に登録されています',
        409
      );
    }

    try {
      const cognitoResult = await ensureCognitoInvitedUser({
        email,
        name: name_kanji,
        resendInviteIfExists: true,
      });

      return successResponse(
        {
          userId: email,
          status: 'success',
          invitationSent: cognitoResult.invitationSent,
          cognitoCreated: cognitoResult.created,
          dbCreated: dbPrep.created,
          message: cognitoResult.message || '生徒を登録し、招待メールを送信しました',
        },
        201
      );
    } catch (cognitoError: any) {
      console.error('Cognito invite failed after DB upsert:', cognitoError);
      // 新規 DB 行だけ残さない（補償削除）
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
    console.error('Create student error:', error);

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
