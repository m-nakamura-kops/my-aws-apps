/**
 * 手動打刻実行
 * POST /v1/attendance/manual
 * 権限: 管理者(3) または スタッフ(2) のみ。event_id と email で打刻。
 * 入室: 新規 INSERT（type=entry, in_time=JST, out_time=NULL）。
 * 退室: 未退室の最新入室行の out_time を UPDATE（新規 INSERT しない）。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import { checkStaffOrAdminPermission } from '../../../shared/utils/auth';
import { UserRole } from '../../../shared/utils/role-check';

function nowJstMysqlDatetime(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

type DbResult =
  | { ok: true; logId: number | null; action: 'entry' | 'exit'; in_time?: string | null; out_time?: string | null }
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
    const nowJst = nowJstMysqlDatetime();

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

      if (isExit) {
        const [openRows] = (await conn.execute(
          `SELECT log_id, in_time FROM attendance_logs
           WHERE event_id = ? AND email = ?
             AND in_time IS NOT NULL AND out_time IS NULL
           ORDER BY log_id DESC LIMIT 1`,
          [eventIdNum, email]
        )) as any[];
        if (openRows.length === 0) {
          return {
            ok: false,
            response: errorResponse('BAD_REQUEST', 'No open check-in to check out', 400),
          };
        }
        const open = openRows[0];
        await conn.execute(
          `UPDATE attendance_logs
           SET out_time = ?, staff_email = ?, updated_at = CURRENT_TIMESTAMP
           WHERE log_id = ? AND out_time IS NULL`,
          [nowJst, staffEmail, open.log_id]
        );
        return {
          ok: true,
          logId: Number(open.log_id),
          action: 'exit',
          in_time: open.in_time ?? null,
          out_time: nowJst,
        };
      }

      const [openForEntry] = (await conn.execute(
        `SELECT log_id FROM attendance_logs
         WHERE event_id = ? AND email = ?
           AND in_time IS NOT NULL AND out_time IS NULL
         LIMIT 1`,
        [eventIdNum, email]
      )) as any[];
      if (openForEntry.length > 0) {
        return {
          ok: false,
          response: errorResponse('CONFLICT', 'Already checked in (not yet checked out)', 409),
        };
      }

      try {
        const [result] = (await conn.execute(
          `INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email)
           VALUES (?, ?, 'entry', ?, NULL, ?)`,
          [email, eventIdNum, nowJst, staffEmail]
        )) as any[];
        const logId = result?.insertId ?? null;
        return { ok: true, logId, action: 'entry', in_time: nowJst, out_time: null };
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
    return successResponse({
      log_id: dbResult.logId,
      action: dbResult.action === 'exit' ? 'out' : 'in',
      in_time: dbResult.in_time ?? null,
      out_time: dbResult.out_time ?? null,
      message,
    });
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
