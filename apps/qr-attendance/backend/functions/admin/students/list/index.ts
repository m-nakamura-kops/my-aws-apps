/**
 * 生徒名簿一覧取得Lambda関数
 * GET /v1/admin/students
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

    // クエリパラメータの取得
    const queryParams = event.queryStringParameters || {};
    let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
    let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
    const search = queryParams.search; // 検索条件（名前、メールアドレス、カナ）
    const orgId = queryParams.org_id; // 組織IDでフィルタ

    // 値の検証（SQLインジェクション対策）
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      limit = 100;
    }
    if (isNaN(offset) || offset < 0) {
      offset = 0;
    }

    // データベース接続を取得
    const db = getDB();

    // 生徒一覧取得（role_flag = 1 が利用者/生徒）
    let query = `
      SELECT 
        u.email,
        u.name_kanji,
        u.name_kana,
        u.tel,
        u.org_id,
        u.remarks,
        u.created_at,
        u.updated_at,
        MAX(al.in_time) as last_attendance_date
      FROM users u
      LEFT JOIN attendance_logs al ON u.email = al.email
      WHERE u.role_flag = 1
    `;
    const params: any[] = [];
    const countParams: any[] = [];

    // 検索条件の追加
    if (search) {
      query += ` AND (
        u.name_kanji LIKE ? OR 
        u.name_kana LIKE ? OR 
        u.email LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    // 組織IDでフィルタ
    if (orgId) {
      query += ` AND u.org_id = ?`;
      params.push(orgId);
      countParams.push(orgId);
    }

    query += ` GROUP BY u.email ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [students] = await db.execute(query, params) as any[];

    // 総件数を取得
    let countQuery = `
      SELECT COUNT(DISTINCT u.email) as total
      FROM users u
      WHERE u.role_flag = 1
    `;
    if (search) {
      countQuery += ` AND (
        u.name_kanji LIKE ? OR 
        u.name_kana LIKE ? OR 
        u.email LIKE ?
      )`;
    }
    if (orgId) {
      countQuery += ` AND u.org_id = ?`;
    }

    const [countResult] = await db.execute(countQuery, countParams) as any[];
    const total = countResult[0]?.total || 0;

    // レスポンスデータの整形
    const formattedStudents = (students || []).map((student: any) => ({
      email: student.email,
      name_kanji: student.name_kanji,
      name_kana: student.name_kana,
      tel: student.tel,
      org_id: student.org_id,
      remarks: student.remarks,
      registration_date: student.created_at,
      last_attendance_date: student.last_attendance_date || null,
    }));

    return successResponse({
      students: formattedStudents,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('List students error:', error);

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
