/**
 * 手動打刻実行
 * POST /v1/attendance/manual
 * 権限: 管理者(3) または スタッフ(2) のみ。event_id と email で打刻。二重打刻時は 409。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import { checkStaffOrAdminPermission } from '../../../shared/utils/auth';
import { UserRole } from '../../../shared/utils/role-check';

const NOTES_MANUAL = '手動打刻';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    await initDBFromSecrets();
    const permission = await checkStaffOrAdminPermission(event);
    if (!permission.authorized) {
      return errorResponse(
        permission.statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
        permission.error,
        permission.statusCode
      );
    }
    const staffEmail = permission.email;

    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    let body: { event_id?: unknown; eventId?: unknown; email?: string; user_id?: string };
    try {
      body = JSON.parse(event.body);
    } catch {
      return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400);
    }

    const eventIdRaw = body.event_id ?? body.eventId;
    const email = (body.email ?? body.user_id)?.trim();

    if (eventIdRaw == null || eventIdRaw === '' || !email) {
      return errorResponse(
        'BAD_REQUEST',
        'event_id and email (or user_id) are required',
        400
      );
    }

    const eventIdNum = parseInt(String(eventIdRaw), 10);
    if (isNaN(eventIdNum) || eventIdNum < 1) {
      return errorResponse('BAD_REQUEST', 'Invalid event_id', 400);
    }

    const db = getDB();

    const [events] = await db.execute(
      'SELECT event_id FROM events WHERE event_id = ?',
      [eventIdNum]
    ) as any[];
    if (events.length === 0) {
      return errorResponse('NOT_FOUND', 'Event not found', 404);
    }

    const [users] = await db.execute(
      'SELECT email, role_flag FROM users WHERE email = ?',
      [email]
    ) as any[];
    if (users.length === 0) {
      return errorResponse('NOT_FOUND', 'User not found', 404);
    }
    if (users[0].role_flag !== UserRole.USER) {
      return errorResponse(
        'BAD_REQUEST',
        'Target user must be a student (role_flag=1)',
        400
      );
    }

    const [existing] = await db.execute(
      'SELECT log_id FROM attendance_logs WHERE event_id = ? AND email = ? LIMIT 1',
      [eventIdNum, email]
    ) as any[];
    if (existing.length > 0) {
      return errorResponse(
        'CONFLICT',
        'Already checked in for this event',
        409
      );
    }

    try {
      const [result] = await db.execute(
        `INSERT INTO attendance_logs (email, event_id, in_time, staff_email, notes)
         VALUES (?, ?, NOW(), ?, ?)`,
        [email, eventIdNum, staffEmail, NOTES_MANUAL]
      ) as any;
      const logId = result?.insertId ?? null;

      return successResponse(
        { log_id: logId, event_id: eventIdNum, email, message: 'Manual attendance recorded' },
        201
      );
    } catch (insertErr: any) {
      const code = insertErr?.code ?? insertErr?.errno;
      if (code === 'ER_DUP_ENTRY' || code === 1062) {
        return errorResponse(
          'CONFLICT',
          'Already checked in for this event',
          409
        );
      }
      throw insertErr;
    }
  } catch (error: any) {
    console.error('Manual attendance error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
