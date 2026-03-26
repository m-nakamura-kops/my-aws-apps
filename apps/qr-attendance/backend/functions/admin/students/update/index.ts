/**
 * 生徒情報更新Lambda関数
 * PUT /v1/admin/students/{email}
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkAdminPermission } from '../../../../shared/utils/auth';
import { parseEmailPathParamForDb } from '../../../../shared/utils/parse-path-email';

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

    const rawEmail = event.pathParameters?.email;
    const parsed = parseEmailPathParamForDb(rawEmail);
    if (!parsed.ok) {
      return errorResponse(
        'BAD_REQUEST',
        parsed.reason === 'decodeURIComponent_error'
          ? 'Invalid email encoding in path'
          : 'email is required',
        400
      );
    }
    const email = parsed.email;

    // リクエストボディの解析
    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    const { name_kanji, name_kana, tel, org_id, remarks, is_active } = JSON.parse(event.body);

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
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return errorResponse('BAD_REQUEST', 'No fields to update', 400);
    }

    updateValues.push(email);

    const pool = getDB();
    const updatedUsers = await withConnection(pool, async (conn) => {
      const [existingUsers] = (await conn.execute(
        'SELECT email, role_flag FROM users WHERE email = ?',
        [email]
      )) as any[];
      if (existingUsers.length === 0) {
        return { err: 'not_found' as const };
      }
      if (existingUsers[0].role_flag !== 1) {
        return { err: 'not_student' as const };
      }
      await conn.execute(`UPDATE users SET ${updateFields.join(', ')} WHERE email = ?`, updateValues);
      const [rows] = (await conn.execute(
        'SELECT email, name_kanji, name_kana, tel, org_id, remarks, created_at, updated_at FROM users WHERE email = ?',
        [email]
      )) as any[];
      return { err: null, student: rows[0] };
    });

    if (updatedUsers.err === 'not_found') {
      return errorResponse('NOT_FOUND', 'Student not found', 404);
    }
    if (updatedUsers.err === 'not_student') {
      return errorResponse('BAD_REQUEST', 'User is not a student', 400);
    }

    return successResponse({
      student: updatedUsers.student,
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
