/**
 * イベント一覧取得
 * GET /v1/events
 * 権限マトリクス: 公開中のイベント閲覧・申込は利用者・スタッフ・管理者すべて可。認証済みなら誰でも取得可能。
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import { getUserEmailFromRequest } from '../../../shared/utils/auth';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    await initDBFromSecrets();
    const email = getUserEmailFromRequest(event);
    if (!email) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const queryParams = event.queryStringParameters || {};
    let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
    let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
    if (isNaN(limit) || limit < 1 || limit > 1000) limit = 100;
    if (isNaN(offset) || offset < 0) offset = 0;

    const pool = getDB();
    const [events, countResult] = await withConnection(pool, async (conn) => {
      const [ev] = (await conn.execute(
        'SELECT event_id, event_name, event_date, location, capacity, summary, created_at, updated_at FROM events ORDER BY event_date DESC LIMIT ? OFFSET ?',
        [limit, offset]
      )) as any[];
      const [cnt] = (await conn.execute('SELECT COUNT(*) as total FROM events')) as any[];
      return [ev, cnt] as const;
    });
    const total = countResult[0]?.total || 0;

    return successResponse({
      events: events || [],
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (error: any) {
    console.error('List events error:', error);
    return errorResponse('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
  }
};
