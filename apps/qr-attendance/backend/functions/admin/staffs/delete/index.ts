/**
 * スタッフ削除Lambda関数（利用者に変更）
 * DELETE /v1/admin/staffs/{email}
 * スタッフ/管理者を「利用者」に変更するのみ。アカウントは削除しない。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkAdminPermission } from '../../../../shared/utils/auth';

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

    // パスパラメータからemailを取得（URLデコード）
    const rawEmail = event.pathParameters?.email;
    const email = rawEmail ? decodeURIComponent(rawEmail) : null;
    if (!email) {
      return errorResponse('BAD_REQUEST', 'email is required', 400);
    }

    // データベース接続を取得
    const db = getDB();

    // ユーザーの存在確認（role_flag = 2 スタッフ または 3 管理者）
    const [existingUsers] = await db.execute(
      'SELECT email, role_flag FROM users WHERE email = ?',
      [email]
    ) as any[];

    if (existingUsers.length === 0) {
      return errorResponse('NOT_FOUND', 'Staff not found', 404);
    }

    const role = existingUsers[0].role_flag;
    if (role !== 2 && role !== 3) {
      return errorResponse('BAD_REQUEST', 'User is not a staff or admin', 400);
    }

    // スタッフを辞めさせても利用者としてアカウントは残す（role_flag を 1 に変更）
    await db.execute('UPDATE users SET role_flag = 1 WHERE email = ?', [email]);

    const [attendanceLogs] = await db.execute(
      'SELECT COUNT(*) as count FROM attendance_logs WHERE staff_email = ?',
      [email]
    ) as any[];
    const logCount = attendanceLogs[0]?.count || 0;

    return successResponse({
      message: 'スタッフを利用者に変更しました',
      email: email,
      attendance_records_count: logCount,
    });
  } catch (error: any) {
    console.error('Delete staff error:', error);

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
