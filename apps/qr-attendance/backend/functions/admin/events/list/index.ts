/**
 * イベント一覧取得Lambda関数
 * GET /v1/admin/events
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
    const startDate = queryParams.start_date;
    const endDate = queryParams.end_date;

    // 値の検証（SQLインジェクション対策）
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      limit = 100;
    }
    if (isNaN(offset) || offset < 0) {
      offset = 0;
    }

    const pool = getDB();

    // イベント一覧取得
    let query = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      query += ' AND event_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND event_date <= ?';
      params.push(endDate);
    }

    query += ` ORDER BY event_date DESC LIMIT ${limit} OFFSET ${offset}`;

    const [events, countResult] = await withConnection(pool, async (conn) => {
      const [ev] = (await conn.execute(query, params)) as any[];
      let countQuery = 'SELECT COUNT(*) as total FROM events WHERE 1=1';
      const countParams: any[] = [];

      if (startDate) {
        countQuery += ' AND event_date >= ?';
        countParams.push(startDate);
      }

      if (endDate) {
        countQuery += ' AND event_date <= ?';
        countParams.push(endDate);
      }

      const [cnt] = (await conn.execute(countQuery, countParams)) as any[];
      return [ev, cnt] as const;
    });
    const total = countResult[0]?.total || 0;

    return successResponse({
      events: events || [],
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('List events error:', error);

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
