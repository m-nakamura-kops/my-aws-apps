/**
 * スタッフ一覧取得Lambda関数
 * GET /v1/admin/staffs
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../../shared/db/connection';
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

    // 値の検証（SQLインジェクション対策）
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      limit = 100;
    }
    if (isNaN(offset) || offset < 0) {
      offset = 0;
    }

    const pool = getDB();

    // スタッフ一覧取得（role_flag = 2 スタッフ, 3 管理者）
    let query = `
      SELECT 
        u.email,
        u.name_kanji,
        u.name_kana,
        u.tel,
        u.org_id,
        u.remarks,
        u.role_flag,
        u.created_at,
        u.updated_at,
        COUNT(DISTINCT al.log_id) as total_attendance_records
      FROM users u
      LEFT JOIN attendance_logs al ON u.email = al.staff_email
      WHERE u.role_flag IN (2, 3)
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

    query += ` GROUP BY u.email ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [staffs, countResult] = await withConnection(pool, async (conn) => {
      const [st] = (await conn.execute(query, params)) as any[];
      let countQuery = `
      SELECT COUNT(DISTINCT u.email) as total
      FROM users u
      WHERE u.role_flag IN (2, 3)
    `;
      if (search) {
        countQuery += ` AND (
        u.name_kanji LIKE ? OR 
        u.name_kana LIKE ? OR 
        u.email LIKE ?
      )`;
      }
      const [cnt] = (await conn.execute(countQuery, countParams)) as any[];
      return [st, cnt] as const;
    });
    const total = countResult[0]?.total || 0;

    // レスポンスデータの整形
    const formattedStaffs = (staffs || []).map((staff: any) => ({
      email: staff.email,
      name_kanji: staff.name_kanji,
      name_kana: staff.name_kana,
      tel: staff.tel,
      org_id: staff.org_id,
      remarks: staff.remarks,
      role_flag: staff.role_flag,
      registration_date: staff.created_at,
      total_attendance_records: staff.total_attendance_records || 0,
    }));

    return successResponse({
      staffs: formattedStaffs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('List staffs error:', error);

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
