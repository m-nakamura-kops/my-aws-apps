/**
 * 申込一覧取得Lambda関数
 * GET /v1/users/registrations
 * 管理者: email 未指定で全利用者の申込一覧。一般: 自分の申込のみ（email 未指定時は認証ユーザーで絞る）
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import { getUserEmailFromRequest, getUserRoleFlag } from '../../../shared/utils/auth';
import { isAdmin } from '../../../shared/utils/role-check';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const filterEmail = queryParams.email || null;
    const eventId = queryParams.event_id;
    let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
    let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
    if (isNaN(limit) || limit < 1 || limit > 1000) limit = 100;
    if (isNaN(offset) || offset < 0) offset = 0;

    await initDBFromSecrets();
    const pool = getDB();

    const requestEmail = getUserEmailFromRequest(event);
    if (!requestEmail) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    const roleFlag = await getUserRoleFlag(requestEmail);
    const isAdminUser = isAdmin(roleFlag);

    if (!isAdminUser) {
      if (filterEmail != null && filterEmail !== '' && filterEmail !== requestEmail) {
        return errorResponse('FORBIDDEN', 'You can only view your own registrations', 403);
      }
    }

    const emailFilter = isAdminUser ? filterEmail : requestEmail;
    const params: any[] = [];
    let whereClause = '';
    if (emailFilter) {
      whereClause = ' WHERE r.email = ?';
      params.push(emailFilter);
    }
    if (eventId) {
      whereClause += whereClause ? ' AND r.event_id = ?' : ' WHERE r.event_id = ?';
      params.push(eventId);
    }

    const limitInt = Math.min(1000, Math.max(1, limit));
    const offsetInt = Math.max(0, offset);

    const query = `
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
      ${whereClause}
      ORDER BY r.created_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;
    const [registrations, countResult] = await withConnection(pool, async (conn) => {
      const [regs] = (await conn.execute(query, params)) as any[];
      const countQuery = `SELECT COUNT(*) as total FROM registrations r ${whereClause}`;
      const [cnt] = (await conn.execute(countQuery, params)) as any[];
      return [regs, cnt] as const;
    });
    const total = countResult[0]?.total || 0;

    return successResponse({
      registrations: registrations.map((reg: any) => ({
        reg_id: reg.reg_id,
        email: reg.email,
        user_name: reg.user_name,
        event_id: reg.event_id,
        event_name: reg.event_name,
        event_date: reg.event_date,
        location: reg.location,
        capacity: reg.capacity,
        registration_date: reg.registration_date,
      })),
      pagination: {
        total,
        limit: limitInt,
        offset: offsetInt,
        hasMore: offsetInt + limitInt < total,
      },
    });
  } catch (error: any) {
    console.error('Get registrations error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
