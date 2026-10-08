/**
 * イベント参加申込Lambda関数
 * POST /v1/users/events/{eventId}/register
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return errorResponse('BAD_REQUEST', 'eventId is required', 400);
    }

    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    const { email } = JSON.parse(event.body);
    if (!email) {
      return errorResponse('BAD_REQUEST', 'email is required', 400);
    }

    await initDBFromSecrets();
    const pool = getDB();

    type Outcome =
      | { kind: 'ok'; insertId: number }
      | { kind: 'not_found_event' }
      | { kind: 'full' }
      | { kind: 'not_found_user' }
      | { kind: 'inactive' }
      | { kind: 'already' };

    const outcome = await withConnection(pool, async (conn): Promise<Outcome> => {
      const [events] = (await conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId])) as any[];
      if (events.length === 0) {
        return { kind: 'not_found_event' };
      }
      const eventData = events[0];

      if (eventData.capacity !== null) {
        const [currentRegistrations] = (await conn.execute(
          'SELECT COUNT(*) as count FROM registrations WHERE event_id = ?',
          [eventId]
        )) as any[];
        const currentCount = currentRegistrations[0]?.count || 0;
        if (currentCount >= eventData.capacity) {
          return { kind: 'full' };
        }
      }

      const [users] = (await conn.execute(
        'SELECT email, COALESCE(is_active, 1) AS is_active FROM users WHERE email = ?',
        [email]
      )) as any[];
      if (users.length === 0) {
        return { kind: 'not_found_user' };
      }
      if (users[0].is_active === 0) {
        return { kind: 'inactive' };
      }

      const [existingRegistrations] = (await conn.execute(
        'SELECT * FROM registrations WHERE email = ? AND event_id = ?',
        [email, eventId]
      )) as any[];
      if (existingRegistrations.length > 0) {
        return { kind: 'already' };
      }

      const [result] = (await conn.execute(
        'INSERT INTO registrations (email, event_id) VALUES (?, ?)',
        [email, eventId]
      )) as any;
      return { kind: 'ok', insertId: result.insertId };
    });

    if (outcome.kind === 'not_found_event') {
      return errorResponse('NOT_FOUND', 'Event not found', 404);
    }
    if (outcome.kind === 'full') {
      return errorResponse('BAD_REQUEST', 'Event is full', 400);
    }
    if (outcome.kind === 'not_found_user') {
      return errorResponse('NOT_FOUND', 'User not found', 404);
    }
    if (outcome.kind === 'inactive') {
      return errorResponse('FORBIDDEN', '退会済みのため新規申込はできません', 403);
    }
    if (outcome.kind === 'already') {
      return errorResponse('BAD_REQUEST', 'Already registered for this event', 400);
    }

    return successResponse({
      reg_id: outcome.insertId,
      email,
      event_id: parseInt(eventId, 10),
      message: '参加申込が完了しました',
    });
  } catch (error: any) {
    console.error('Register for event error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return errorResponse('BAD_REQUEST', 'Already registered for this event', 400);
    }

    return errorResponse('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
  }
};
