/**
 * 打刻履歴取得Lambda関数
 * GET /v1/users/attendance/history
 * 権限マトリクスに従い、利用者・スタッフ・管理者とも「自分の打刻履歴」のみ取得可能。
 *
 * - in_time が無い exit 専用行は除外（1入退室=1行モデル）
 * - DATETIME は接続側で JST 壁時計文字列として返す
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { getUserEmailFromRequest } from '../../../../shared/utils/auth';

/** NULL / Epoch / 不正値を API レスポンス上で null に正規化 */
function normalizeDateTime(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (!s || s === 'null' || s.startsWith('0000-00-00')) return null;
  // Date オブジェクトや ISO 文字列も壁時計 YYYY-MM-DD HH:mm:ss に寄せる
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    const year = parseInt(m[1], 10);
    if (year < 1980) return null;
    return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1980) return null;
  // 最終手段: Asia/Tokyo で整形
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const eventId = queryParams.event_id;
    let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
    let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
    const startDate = queryParams.start_date;
    const endDate = queryParams.end_date;

    if (isNaN(limit) || limit < 1 || limit > 1000) limit = 100;
    if (isNaN(offset) || offset < 0) offset = 0;

    await initDBFromSecrets();
    const pool = getDB();

    const requestEmail = getUserEmailFromRequest(event);
    if (!requestEmail) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const emailFilter = requestEmail;
    const params: any[] = [];
    // 入室行のみ（in_time 必須）。旧 exit 単独行は履歴に出さない
    let whereClause =
      " WHERE al.in_time IS NOT NULL AND (al.type IS NULL OR al.type = '' OR al.type = 'entry')";
    whereClause += ' AND al.email = ?';
    params.push(emailFilter);

    if (eventId) {
      whereClause += ' AND al.event_id = ?';
      params.push(eventId);
    }
    if (startDate) {
      whereClause += ' AND al.in_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND al.in_time <= ?';
      params.push(endDate);
    }

    const limitInt = Math.min(1000, Math.max(1, limit));
    const offsetInt = Math.max(0, offset);

    const query = `
      SELECT 
        al.log_id,
        al.email,
        u.name_kanji AS user_name,
        al.event_id,
        e.event_name,
        e.event_date,
        al.in_time,
        al.out_time,
        TIMESTAMPDIFF(MINUTE, al.in_time, al.out_time) AS stay_minutes,
        al.staff_email,
        staff.name_kanji AS staff_name,
        al.created_at
      FROM attendance_logs al
      INNER JOIN users u ON al.email = u.email
      INNER JOIN events e ON al.event_id = e.event_id
      INNER JOIN users staff ON al.staff_email = staff.email
      ${whereClause}
      ORDER BY al.in_time DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;
    const [logs, countResult] = await withConnection(pool, async (conn) => {
      const [l] = (await conn.execute(query, params)) as any[];
      const countQuery = `SELECT COUNT(*) as total FROM attendance_logs al ${whereClause}`;
      const [c] = (await conn.execute(countQuery, params)) as any[];
      return [l, c] as const;
    });
    const total = countResult[0]?.total || 0;

    return successResponse({
      logs: logs.map((log: any) => ({
        log_id: log.log_id,
        email: log.email,
        user_name: log.user_name,
        event_id: log.event_id,
        event_name: log.event_name,
        event_date: normalizeDateTime(log.event_date),
        in_time: normalizeDateTime(log.in_time),
        out_time: normalizeDateTime(log.out_time),
        stay_minutes: log.stay_minutes,
        staff_email: log.staff_email,
        staff_name: log.staff_name,
        created_at: normalizeDateTime(log.created_at),
      })),
      pagination: {
        total,
        limit: limitInt,
        offset: offsetInt,
        hasMore: offsetInt + limitInt < total,
      },
    });
  } catch (error: any) {
    console.error('Get attendance history error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
