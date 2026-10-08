/**
 * 管理者用：全申込一覧取得（横断・時系列）
 * GET /v1/admin/registrations
 * 権限: 管理者のみ。全イベントの申込を申込日時降順で返す。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkAdminPermission } from '../../../../shared/utils/auth';

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

    const queryParams = event.queryStringParameters || {};
    let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
    let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
    const eventId = queryParams.event_id;
    const emailFilter = queryParams.email;

    if (isNaN(limit) || limit < 1 || limit > 1000) limit = 100;
    if (isNaN(offset) || offset < 0) offset = 0;

    const pool = getDB();

    let query = `
      SELECT 
        r.reg_id,
        r.email,
        u.name_kanji AS user_name,
        r.event_id,
        e.event_name,
        e.event_date,
        e.location,
        e.capacity,
        r.created_at AS registration_date
      FROM registrations r
      INNER JOIN users u ON r.email = u.email
      INNER JOIN events e ON r.event_id = e.event_id
      WHERE 1=1
    `;
    const params: any[] = [];
    const countParams: any[] = [];

    if (eventId) {
      query += ' AND r.event_id = ?';
      params.push(eventId);
      countParams.push(eventId);
    }
    if (emailFilter) {
      query += ' AND r.email LIKE ?';
      const pattern = `%${emailFilter}%`;
      params.push(pattern);
      countParams.push(pattern);
    }

    query += ` ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [rows, countResult] = await withConnection(pool, async (conn) => {
      const [r] = (await conn.execute(query, params)) as any[];
      let countQuery = `SELECT COUNT(*) as total FROM registrations r WHERE 1=1`;
      if (eventId) countQuery += ' AND r.event_id = ?';
      if (emailFilter) countQuery += ' AND r.email LIKE ?';
      const [cnt] = (await conn.execute(countQuery, countParams)) as any[];
      return [r, cnt] as const;
    });
    const total = countResult[0]?.total || 0;

    const registrations = (rows || []).map((r: any) => ({
      reg_id: r.reg_id,
      email: r.email,
      user_name: r.user_name,
      event_id: r.event_id,
      event_name: r.event_name,
      event_date: r.event_date,
      location: r.location,
      capacity: r.capacity,
      registration_date: r.registration_date,
    }));

    return successResponse({
      registrations,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (error: any) {
    console.error('Admin registrations list error:', error);
    return errorResponse('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
  }
};
