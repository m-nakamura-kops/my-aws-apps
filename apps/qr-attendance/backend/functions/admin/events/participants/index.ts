/**
 * イベント参加者一覧取得Lambda関数
 * GET /v1/admin/events/{eventId}/participants
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkStaffOrAdminPermission } from '../../../../shared/utils/auth';
import { isStaffOrAdmin } from '../../../../shared/utils/role-check';

function isInvalidDatetime(v: unknown): boolean {
  if (v == null || v === '') return true;
  if (v instanceof Date) {
    const ms = v.getTime();
    if (Number.isNaN(ms)) return true;
    if (v.getFullYear() < 1980) return true;
    return false;
  }
  const s = String(v).trim();
  if (s === '' || s === 'null' || s.startsWith('0000-00-00')) return true;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return true;
  if (d.getFullYear() < 1980) return true;
  return false;
}

/**
 * DB の DATETIME は JST の壁時計。オフセット無しで返すとクライアントが UTC と解釈して
 * +9 時間ずれるため、必ず +09:00 付きの ISO8601 にして返す。
 */
function toJstIsoOrNull(v: unknown): string | null {
  if (isInvalidDatetime(v)) return null;
  const s = v instanceof Date ? '' : String(v).trim();
  const wall = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (wall) {
    return `${wall[1]}-${wall[2]}-${wall[3]}T${wall[4]}:${wall[5]}:${wall[6] ?? '00'}+09:00`;
  }
  const d = v instanceof Date ? v : new Date(s);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1980) return null;
  return d.toISOString();
}

/**
 * LIMIT 用: 1..max の整数。
 * mysql2 + prepared statement で LIMIT ? / OFFSET ? が Incorrect arguments to mysql_stmt_execute になる環境があるため、
 * 検証済み整数のみテンプレートに埋め込む（SQL インジェクションは clamp で防ぐ）。
 */
function clampLimit(v: unknown, fallback: number, max: number): number {
  if (v === undefined || v === null || v === '') return fallback;
  const n = typeof v === 'number' && Number.isFinite(v) ? v : parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return fallback;
  const t = Math.trunc(n);
  if (t < 1) return fallback;
  if (t > max) return max;
  return t;
}

function clampOffset(v: unknown, fallback: number): number {
  if (v === undefined || v === null || v === '') return fallback;
  const n = typeof v === 'number' && Number.isFinite(v) ? v : parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return fallback;
  const t = Math.trunc(n);
  return t < 0 ? fallback : t;
}

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
    const canViewAll = isStaffOrAdmin(permission.roleFlag);
    const requestEmail = permission.email?.trim() || '';

    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return errorResponse('BAD_REQUEST', 'eventId is required', 400);
    }

    const queryParams = event.queryStringParameters || {};
    const limit = clampLimit(queryParams.limit ?? undefined, 100, 1000);
    const offset = clampOffset(queryParams.offset ?? undefined, 0);

    const pool = getDB();

    const payload = await withConnection(pool, async (conn) => {
      const [events] = (await conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId])) as any[];
      if (events.length === 0) {
        return { notFound: true as const };
      }
      const eventData = events[0];

      let rows: any[];
      let total: number;

      if (canViewAll) {
        const [r] = (await conn.execute(
          `SELECT 
            vp.email,
            vp.name_kanji,
            vp.name_kana,
            vp.registration_date,
            u.tel,
            u.org_id,
            u.role_flag,
            al.in_time,
            al.out_time
          FROM v_event_participants vp
          INNER JOIN users u ON u.email = vp.email
          LEFT JOIN attendance_logs al ON al.log_id = (
            SELECT al2.log_id FROM attendance_logs al2
            WHERE al2.event_id = vp.event_id AND al2.email = vp.email
              AND al2.in_time IS NOT NULL
            ORDER BY al2.log_id DESC LIMIT 1
          )
          WHERE vp.event_id = ?
          ORDER BY vp.registration_date DESC
          LIMIT ${limit} OFFSET ${offset}`,
          [eventId]
        )) as any[];
        rows = r || [];
        const [countResult] = (await conn.execute(
          'SELECT COUNT(*) as total FROM v_event_participants WHERE event_id = ?',
          [eventId]
        )) as any[];
        total = countResult[0]?.total || 0;
      } else {
        if (!requestEmail) {
          return { notFound: false as const, forbiddenSelf: true as const };
        }
        const [r] = (await conn.execute(
          `SELECT 
            vp.email,
            vp.name_kanji,
            vp.name_kana,
            vp.registration_date,
            u.tel,
            u.org_id,
            u.role_flag,
            al.in_time,
            al.out_time
          FROM v_event_participants vp
          INNER JOIN users u ON u.email = vp.email
          LEFT JOIN attendance_logs al ON al.log_id = (
            SELECT al2.log_id FROM attendance_logs al2
            WHERE al2.event_id = vp.event_id AND al2.email = vp.email
              AND al2.in_time IS NOT NULL
            ORDER BY al2.log_id DESC LIMIT 1
          )
          WHERE vp.event_id = ? AND vp.email = ?
          LIMIT 1`,
          [eventId, requestEmail]
        )) as any[];
        rows = r || [];
        total = rows.length;
      }

      const participantsWithDetails = rows.map((row) => ({
        email: row.email,
        name_kanji: row.name_kanji,
        name_kana: row.name_kana,
        tel: row.tel ?? null,
        org_id: row.org_id ?? null,
        role_flag: row.role_flag ?? null,
        registration_date: row.registration_date,
        in_time: toJstIsoOrNull(row.in_time),
        out_time: toJstIsoOrNull(row.out_time),
      }));

      return {
        notFound: false as const,
        forbiddenSelf: false as const,
        eventData,
        participantsWithDetails,
        total,
        limit,
        offset,
      };
    });

    if ('forbiddenSelf' in payload && payload.forbiddenSelf) {
      return errorResponse('FORBIDDEN', 'User email not available', 403);
    }

    if (payload.notFound) {
      return errorResponse('NOT_FOUND', 'Event not found', 404);
    }

    return successResponse({
      event_id: parseInt(eventId, 10),
      event_name: payload.eventData.event_name,
      event_date: payload.eventData.event_date,
      participants: payload.participantsWithDetails,
      pagination: {
        total: payload.total,
        limit: payload.limit,
        offset: payload.offset,
        hasMore: payload.offset + payload.limit < payload.total,
      },
    });
  } catch (error: any) {
    console.error('Get participants error:', error);
    return errorResponse('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
  }
};
