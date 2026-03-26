/**
 * イベント参加取消Lambda関数
 * DELETE /v1/users/events/{eventId}/register
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

    let email: string | undefined;
    if (event.queryStringParameters?.email) {
      email = event.queryStringParameters.email;
    } else if (event.body) {
      const body = JSON.parse(event.body);
      email = body.email;
    }

    if (!email) {
      return errorResponse('BAD_REQUEST', 'email is required', 400);
    }

    await initDBFromSecrets();
    const pool = getDB();

    type Outcome = { kind: 'ok' } | { kind: 'no_event' } | { kind: 'no_reg' };
    const outcome = await withConnection(pool, async (conn): Promise<Outcome> => {
      const [events] = (await conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId])) as any[];
      if (events.length === 0) {
        return { kind: 'no_event' };
      }
      const [registrations] = (await conn.execute(
        'SELECT * FROM registrations WHERE email = ? AND event_id = ?',
        [email, eventId]
      )) as any[];
      if (registrations.length === 0) {
        return { kind: 'no_reg' };
      }
      await conn.execute('DELETE FROM registrations WHERE email = ? AND event_id = ?', [email, eventId]);
      return { kind: 'ok' };
    });

    if (outcome.kind === 'no_event') {
      return errorResponse('NOT_FOUND', 'Event not found', 404);
    }
    if (outcome.kind === 'no_reg') {
      return errorResponse('NOT_FOUND', 'Registration not found', 404);
    }

    return successResponse({
      message: '参加申込を取消しました',
      email,
      event_id: parseInt(eventId, 10),
    });
  } catch (error: any) {
    console.error('Unregister from event error:', error);
    return errorResponse('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
  }
};
