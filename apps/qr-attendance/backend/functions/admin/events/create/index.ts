/**
 * イベント作成Lambda関数
 * POST /v1/admin/events
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

    // リクエストボディの解析
    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    const { event_name, event_date, location, capacity, summary } = JSON.parse(event.body);

    // バリデーション
    if (!event_name || !event_date) {
      return errorResponse(
        'BAD_REQUEST',
        'event_name and event_date are required',
        400
      );
    }

    // 日付のバリデーション
    const eventDate = new Date(event_date);
    if (isNaN(eventDate.getTime())) {
      return errorResponse('BAD_REQUEST', 'Invalid event_date format', 400);
    }
    // MySQL DATETIME形式に変換（ISO 8601 のままではエラーになるため）
    const eventDateForDb = eventDate.toISOString().slice(0, 19).replace('T', ' ');

    const pool = getDB();

    const { eventId, eventRow } = await withConnection(pool, async (conn) => {
      const [result] = (await conn.execute(
        `INSERT INTO events (event_name, event_date, location, capacity, summary)
       VALUES (?, ?, ?, ?, ?)`,
        [event_name, eventDateForDb, location || null, capacity || null, summary || null]
      )) as any[];
      const id = result.insertId;
      const [events] = (await conn.execute('SELECT * FROM events WHERE event_id = ?', [id])) as any[];
      return { eventId: id, eventRow: events[0] };
    });

    return successResponse(
      {
        eventId: eventId,
        event: eventRow,
      },
      201
    );
  } catch (error: any) {
    console.error('Create event error:', error);

    // データベースエラーの処理
    if (error.code === 'ER_DUP_ENTRY') {
      return errorResponse('CONFLICT', 'Event already exists', 409);
    }

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
