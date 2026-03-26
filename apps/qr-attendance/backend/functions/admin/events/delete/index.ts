/**
 * イベント削除Lambda関数
 * DELETE /v1/admin/events/{eventId}
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

    // パスパラメータからeventIdを取得
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return errorResponse('BAD_REQUEST', 'eventId is required', 400);
    }

    const pool = getDB();

    const found = await withConnection(pool, async (conn) => {
      const [existingEvents] = (await conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId])) as any[];
      if (existingEvents.length === 0) {
        return false;
      }
      await conn.execute('DELETE FROM events WHERE event_id = ?', [eventId]);
      return true;
    });

    if (!found) {
      return errorResponse('NOT_FOUND', 'Event not found', 404);
    }

    return successResponse({
      message: 'Event deleted successfully',
      eventId: parseInt(eventId, 10),
    });
  } catch (error: any) {
    console.error('Delete event error:', error);

    // 外部キー制約エラーの処理
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return errorResponse(
        'CONFLICT',
        'Cannot delete event: it has related records',
        409
      );
    }

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
