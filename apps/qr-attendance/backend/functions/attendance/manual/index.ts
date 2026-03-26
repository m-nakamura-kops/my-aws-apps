/**
 * 手動打刻実行
 * POST /v1/attendance/manual
 * 権限: 管理者(3) または スタッフ(2) のみ。event_id と email で打刻。
 * 入室: type=entry。退室: type=exit（attendance_logs に notes カラムは使わない）。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import { checkStaffOrAdminPermission } from '../../../shared/utils/auth';
import { UserRole } from '../../../shared/utils/role-check';

type DbResult =
  | { ok: true; logId: number | null; action: 'entry' | 'exit' }
  | { ok: false; response: APIGatewayProxyResult };

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
    const staffEmail = String(permission.email ?? '').trim();
    if (!staffEmail) {
      return errorResponse('UNAUTHORIZED', 'Staff email missing from token', 401);
    }

    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    let body: {
      event_id?: unknown;
      eventId?: unknown;
      email?: string;
      user_id?: string;
      action?: unknown;
      type?: unknown;
    };
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

    const actionParam = (body.action ?? body.type ?? 'entry').toString().toLowerCase();
    const isExit = actionParam === 'exit' || actionParam === 'out';

    const pool = getDB();

    const dbResult = await withConnection(pool, async (conn): Promise<DbResult> => {
      const [events] = (await conn.execute('SELECT event_id FROM events WHERE event_id = ?', [
        eventIdNum,
      ])) as any[];
      if (events.length === 0) {
        return {
          ok: false,
          response: errorResponse('NOT_FOUND', 'Event not found', 404),
        };
      }

      const [users] = (await conn.execute('SELECT email, role_flag FROM users WHERE email = ?', [
        email,
      ])) as any[];
      if (users.length === 0) {
        return {
          ok: false,
          response: errorResponse('NOT_FOUND', 'User not found', 404),
        };
      }
      if (users[0].role_flag !== UserRole.USER) {
        return {
          ok: false,
          response: errorResponse(
            'BAD_REQUEST',
            'Target user must be a student (role_flag=1)',
            400
          ),
        };
      }

      const [existingEntry] = (await conn.execute(
        `SELECT log_id FROM attendance_logs WHERE event_id = ? AND email = ? AND type = 'entry' LIMIT 1`,
        [eventIdNum, email]
      )) as any[];

      const [existingExit] = (await conn.execute(
        `SELECT log_id FROM attendance_logs WHERE event_id = ? AND email = ? AND type = 'exit' LIMIT 1`,
        [eventIdNum, email]
      )) as any[];

      if (isExit) {
        if (existingExit.length > 0) {
          return {
            ok: false,
            response: errorResponse('CONFLICT', 'Already checked out for this event', 409),
          };
        }
        try {
          const [result] = (await conn.execute(
            `INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email)
             VALUES (?, ?, 'exit', NULL, NOW(), ?)`,
            [email, eventIdNum, staffEmail]
          )) as any[];
          const logId = result?.insertId ?? null;
          return { ok: true, logId, action: 'exit' };
        } catch (insertErr: any) {
          const code = insertErr?.code ?? insertErr?.errno;
          if (code === 'ER_DUP_ENTRY' || code === 1062) {
            return {
              ok: false,
              response: errorResponse('CONFLICT', 'Already checked out for this event', 409),
            };
          }
          throw insertErr;
        }
      }

      if (existingEntry.length > 0) {
        return {
          ok: false,
          response: errorResponse('CONFLICT', 'Already checked in for this event', 409),
        };
      }

      try {
        const [result] = (await conn.execute(
          `INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email)
           VALUES (?, ?, 'entry', NOW(), NULL, ?)`,
          [email, eventIdNum, staffEmail]
        )) as any[];
        const logId = result?.insertId ?? null;
        return { ok: true, logId, action: 'entry' };
      } catch (insertErr: any) {
        const code = insertErr?.code ?? insertErr?.errno;
        if (code === 'ER_DUP_ENTRY' || code === 1062) {
          return {
            ok: false,
            response: errorResponse('CONFLICT', 'Already checked in for this event', 409),
          };
        }
        throw insertErr;
      }
    });

    if (!dbResult.ok) {
      return dbResult.response;
    }

    const message =
      dbResult.action === 'exit' ? 'Manual exit recorded' : 'Manual attendance recorded';

    return successResponse(
      {
        log_id: dbResult.logId,
        event_id: eventIdNum,
        email,
        action: dbResult.action,
        message,
      },
      201
    );
  } catch (error: any) {
    console.error('Manual attendance error:', error);
    return errorResponse('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
  }
};
