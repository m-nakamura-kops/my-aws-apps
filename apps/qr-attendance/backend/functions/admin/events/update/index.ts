/**
 * イベント更新Lambda関数
 * PUT /v1/admin/events/{eventId}
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

    // パスパラメータからeventIdを取得
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return errorResponse('BAD_REQUEST', 'eventId is required', 400);
    }

    // リクエストボディの解析
    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    const { event_name, event_date, location, capacity, summary } = JSON.parse(event.body);

    // データベース接続を取得（既に初期化済み）
    const db = getDB();

    // イベントの存在確認
    const [existingEvents] = await db.execute(
      'SELECT * FROM events WHERE event_id = ?',
      [eventId]
    ) as any[];

    if (existingEvents.length === 0) {
      return errorResponse('NOT_FOUND', 'Event not found', 404);
    }

    // 更新フィールドの構築
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (event_name !== undefined) {
      updateFields.push('event_name = ?');
      updateValues.push(event_name);
    }
    if (event_date !== undefined) {
      const eventDateObj = new Date(event_date);
      if (isNaN(eventDateObj.getTime())) {
        return errorResponse('BAD_REQUEST', 'Invalid event_date format', 400);
      }
      const eventDateForDb = eventDateObj.toISOString().slice(0, 19).replace('T', ' ');
      updateFields.push('event_date = ?');
      updateValues.push(eventDateForDb);
    }
    if (location !== undefined) {
      updateFields.push('location = ?');
      updateValues.push(location);
    }
    if (capacity !== undefined) {
      updateFields.push('capacity = ?');
      updateValues.push(capacity);
    }
    if (summary !== undefined) {
      updateFields.push('summary = ?');
      updateValues.push(summary);
    }

    if (updateFields.length === 0) {
      return errorResponse('BAD_REQUEST', 'No fields to update', 400);
    }

    updateValues.push(eventId);

    // イベント更新
    await db.execute(
      `UPDATE events SET ${updateFields.join(', ')} WHERE event_id = ?`,
      updateValues
    );

    // 更新されたイベントを取得
    const [updatedEvents] = await db.execute(
      'SELECT * FROM events WHERE event_id = ?',
      [eventId]
    ) as any[];

    return successResponse({
      event: updatedEvents[0],
    });
  } catch (error: any) {
    console.error('Update event error:', error);

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
