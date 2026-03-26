/**
 * 生徒検索（手動打刻用）
 * GET /v1/students/search
 * 権限: 管理者(3) または スタッフ(2) のみ。q で name_kanji / name_kana の部分一致検索。role_flag=1 限定。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import { checkStaffOrAdminPermission } from '../../../shared/utils/auth';
import { UserRole } from '../../../shared/utils/role-check';

/** LIKE 用の % _ \ をエスケープ */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    await initDBFromSecrets();
    const permission = await checkStaffOrAdminPermission(event);
    if (!permission.authorized) {
      return errorResponse(
        permission.statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
        permission.error,
        permission.statusCode
      );
    }

    const q = (event.queryStringParameters?.q ?? '').trim();
    if (!q) {
      return errorResponse('BAD_REQUEST', 'Query parameter "q" is required', 400);
    }

    const likePattern = `%${escapeLike(q)}%`;
    const pool = getDB();
    const [rows] = (await withConnection(pool, async (conn) =>
      conn.execute(
        `SELECT email AS user_id, name_kanji, name_kana, email
       FROM users
       WHERE role_flag = ?
         AND (name_kanji LIKE ? OR name_kana LIKE ?)
       ORDER BY name_kana ASC
       LIMIT 50`,
        [UserRole.USER, likePattern, likePattern]
      )
    )) as any[];

    const users = (rows || []).map((r: any) => ({
      user_id: r.user_id,
      name_kanji: r.name_kanji,
      name_kana: r.name_kana,
      email: r.email,
    }));

    return successResponse({ users });
  } catch (error: any) {
    console.error('Students search error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
