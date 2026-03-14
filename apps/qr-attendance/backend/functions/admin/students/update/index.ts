/**
 * 生徒情報更新Lambda関数
 * PUT /v1/admin/students/{email}
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

    // パスパラメータからemailを取得
    const email = event.pathParameters?.email;
    if (!email) {
      return errorResponse('BAD_REQUEST', 'email is required', 400);
    }

    // リクエストボディの解析
    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    const { name_kanji, name_kana, tel, org_id, remarks, password } = JSON.parse(event.body);

    // データベース接続を取得
    const db = getDB();

    // ユーザーの存在確認（role_flag = 1: 生徒であることを確認）
    const [existingUsers] = await db.execute(
      'SELECT email, role_flag FROM users WHERE email = ?',
      [email]
    ) as any[];

    if (existingUsers.length === 0) {
      return errorResponse('NOT_FOUND', 'Student not found', 404);
    }

    if (existingUsers[0].role_flag !== 1) {
      return errorResponse('BAD_REQUEST', 'User is not a student', 400);
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
      'SELECT email, name_kanji, name_kana, tel, org_id, remarks, created_at, updated_at FROM users WHERE email = ?',
      [email]
    ) as any[];

    return successResponse({
      student: updatedUsers[0],
      message: 'Student updated successfully',
    });
  } catch (error: any) {
    console.error('Update student error:', error);

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
