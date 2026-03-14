/**
 * イベント参加申込Lambda関数
 * POST /v1/users/events/{eventId}/register
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // CORSプリフライトリクエスト対応
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    // パスパラメータからeventIdを取得
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return errorResponse('BAD_REQUEST', 'eventId is required', 400);
    }

    // リクエストボディからemailを取得
    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    const { email } = JSON.parse(event.body);
    if (!email) {
      return errorResponse('BAD_REQUEST', 'email is required', 400);
    }

    // データベース接続を初期化
    await initDBFromSecrets();
    const db = getDB();

    // イベントの存在確認
    const [events] = await db.execute(
      'SELECT * FROM events WHERE event_id = ?',
      [eventId]
    ) as any[];

    if (events.length === 0) {
      return errorResponse('NOT_FOUND', 'Event not found', 404);
    }

    const eventData = events[0];

    // 定員チェック
    if (eventData.capacity !== null) {
      const [currentRegistrations] = await db.execute(
        'SELECT COUNT(*) as count FROM registrations WHERE event_id = ?',
        [eventId]
      ) as any[];

      const currentCount = currentRegistrations[0]?.count || 0;
      if (currentCount >= eventData.capacity) {
        return errorResponse('BAD_REQUEST', 'Event is full', 400);
      }
    }

    // ユーザーの存在確認
    const [users] = await db.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    ) as any[];

    if (users.length === 0) {
      return errorResponse('NOT_FOUND', 'User not found', 404);
    }

    // 既存の申込を確認（重複チェック）
    const [existingRegistrations] = await db.execute(
      'SELECT * FROM registrations WHERE email = ? AND event_id = ?',
      [email, eventId]
    ) as any[];

    if (existingRegistrations.length > 0) {
      return errorResponse('BAD_REQUEST', 'Already registered for this event', 400);
    }

    // 参加申込を登録
    const [result] = await db.execute(
      'INSERT INTO registrations (email, event_id) VALUES (?, ?)',
      [email, eventId]
    ) as any;

    return successResponse({
      reg_id: result.insertId,
      email,
      event_id: parseInt(eventId, 10),
      message: '参加申込が完了しました',
    });
  } catch (error: any) {
    console.error('Register for event error:', error);
    
    // 重複エラーの場合
    if (error.code === 'ER_DUP_ENTRY') {
      return errorResponse('BAD_REQUEST', 'Already registered for this event', 400);
    }

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
