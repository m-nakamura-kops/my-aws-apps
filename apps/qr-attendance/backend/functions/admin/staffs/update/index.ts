/**
 * スタッフ情報更新Lambda関数
 * PUT /v1/admin/staffs/{email}
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkAdminPermission } from '../../../../shared/utils/auth';
import * as crypto from 'crypto';

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

    // リクエストボディの解析
    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    const { name_kanji, name_kana, tel, org_id, remarks, password, role_flag } = JSON.parse(event.body);

    // データベース接続を取得
    const db = getDB();

    // ユーザーの存在確認（role_flag = 2 スタッフ または 3 管理者 のみ編集可能）
    const [existingUsers] = await db.execute(
      'SELECT email, role_flag FROM users WHERE email = ?',
      [email]
    ) as any[];

    if (existingUsers.length === 0) {
      return errorResponse('NOT_FOUND', 'Staff not found', 404);
    }

    const currentRole = existingUsers[0].role_flag;
    if (currentRole !== 2 && currentRole !== 3) {
      return errorResponse('BAD_REQUEST', 'User is not a staff or admin', 400);
    }

    // role_flag の変更は 2 または 3 のみ許可（管理者がスタッフ⇔管理者を切り替え）
    if (role_flag !== undefined) {
      if (role_flag !== 2 && role_flag !== 3) {
        return errorResponse('BAD_REQUEST', 'role_flag must be 2 (staff) or 3 (admin)', 400);
      }
    }

    // 更新フィールドの構築
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (name_kanji !== undefined) {
      updateFields.push('name_kanji = ?');
      updateValues.push(name_kanji);
    }
    if (name_kana !== undefined) {
      updateFields.push('name_kana = ?');
      updateValues.push(name_kana);
    }
    if (tel !== undefined) {
      updateFields.push('tel = ?');
      updateValues.push(tel);
    }
    if (org_id !== undefined) {
      updateFields.push('org_id = ?');
      updateValues.push(org_id);
    }
    if (remarks !== undefined) {
      updateFields.push('remarks = ?');
      updateValues.push(remarks);
    }
    if (password !== undefined) {
      // パスワードのハッシュ化
      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
      updateFields.push('password = ?');
      updateValues.push(hashedPassword);
    }
    if (role_flag !== undefined) {
      updateFields.push('role_flag = ?');
      updateValues.push(role_flag);
    }

    if (updateFields.length === 0) {
      return errorResponse('BAD_REQUEST', 'No fields to update', 400);
    }

    updateValues.push(email);

    // 更新実行
    await db.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE email = ?`,
      updateValues
    );

    // 更新後のユーザー情報を取得
    const [updatedUsers] = await db.execute(
      'SELECT email, name_kanji, name_kana, tel, org_id, remarks, role_flag, created_at, updated_at FROM users WHERE email = ?',
      [email]
    ) as any[];

    return successResponse({
      staff: updatedUsers[0],
      message: 'Staff updated successfully',
    });
  } catch (error: any) {
    console.error('Update staff error:', error);

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
