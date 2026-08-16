/**
 * イベント別出席者一覧CSV取得
 * GET /v1/admin/reports/events/{eventId}/csv
 * 権限: 管理者（role_flag=3）のみ。スタッフは不可。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../../shared/db/secrets';
import {
  errorResponse,
  corsResponse,
  corsHeaders,
  normalizeApiGatewayHeaders,
} from '../../../../../shared/utils/response';
import { checkAdminPermission } from '../../../../../shared/utils/auth';

const BOM = '\uFEFF';

/** ファイル名に使えない文字をアンダースコアに置換（イベント名用） */
function sanitizeFilename(name: string): string {
  return String(name).replace(/[/\\:*?"<>|]/g, '_').trim() || 'イベント';
}

/** RFC 4180: カンマ・改行・ダブルクォートを含む場合は囲み、内部の " は "" にエスケープ */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[,\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** DATETIME を YYYY-MM-DD HH:mm:ss 形式で出力（MySQL の Date オブジェクト対応） */
function formatDateTime(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${sec}`;
}

/** 出席率を小数点第1位まで表示。申込0の場合は 0% を返す（0除算ガード） */
function formatAttendanceRate(totalRegistrations: number, totalAttendees: number): string {
  if (totalRegistrations === 0) return '0.0';
  return ((totalAttendees / totalRegistrations) * 100).toFixed(1);
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    await initDBFromSecrets();
    const permissionCheck = await checkAdminPermission(event);
    if (!permissionCheck.authorized) {
      return errorResponse(
        'FORBIDDEN',
        permissionCheck.error || 'Admin access required',
        403
      );
    }

    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return errorResponse('BAD_REQUEST', 'eventId is required', 400);
    }

    const pool = getDB();

    const { events, rows } = await withConnection(pool, async (conn) => {
      const [ev] = (await conn.execute(
        'SELECT event_id, event_name, event_date FROM events WHERE event_id = ?',
        [eventId]
      )) as any[];
      if (ev.length === 0) {
        return { events: ev, rows: [] as any[] };
      }
      const [r] = (await conn.execute(
        `SELECT
  e.event_id,
  e.event_date,
  e.event_name,
  u.name_kanji,
  u.name_kana,
  u.email,
  CASE WHEN u.role_flag = 1 THEN '生徒' ELSE '一般' END AS category,
  r.created_at AS registration_date,
  al.in_time AS attendance_time
FROM registrations r
INNER JOIN events e ON e.event_id = r.event_id
INNER JOIN users u ON u.email = r.email
LEFT JOIN (
  SELECT event_id, email, MAX(in_time) AS in_time
  FROM attendance_logs
  GROUP BY event_id, email
) al ON al.event_id = r.event_id AND al.email = r.email
WHERE r.event_id = ?
ORDER BY r.created_at ASC`,
        [eventId]
      )) as any[];
      return { events: ev, rows: r || [] };
    });

    if (events.length === 0) {
      return errorResponse('NOT_FOUND', 'Event not found', 404);
    }

    const totalRegistrations = (rows || []).length;
    const totalAttendees = (rows || []).filter((r: any) => r.attendance_time != null).length;
    const noShowCount = totalRegistrations - totalAttendees;
    const attendanceRateStr = formatAttendanceRate(totalRegistrations, totalAttendees);

    const headerRow =
      'イベントID,開催日,イベント名,利用者名,ふりがな,メールアドレス,区分（生徒/一般）,申込日時,打刻日時（実績）';
    const dataRows = (rows || []).map((r: any) =>
      [
        r.event_id,
        formatDateTime(r.event_date),
        escapeCsvField(r.event_name),
        escapeCsvField(r.name_kanji),
        escapeCsvField(r.name_kana),
        escapeCsvField(r.email),
        r.category,
        formatDateTime(r.registration_date),
        r.attendance_time ? formatDateTime(r.attendance_time) : '',
      ].join(',')
    );
    const summaryHeader = '申込数,出席数,欠席数,出席率（%）';
    const summaryRow = [totalRegistrations, totalAttendees, noShowCount, attendanceRateStr].join(',');
    const csvContent = [headerRow, ...dataRows, '', summaryHeader, summaryRow].join('\n');
    const body = BOM + csvContent;

    const eventName = events[0].event_name || '';
    const now = new Date();
    const outputDateStr =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const safeEventName = sanitizeFilename(eventName);
    const filename = `出席レポート_${safeEventName}_${outputDateStr}.csv`;

    return {
      statusCode: 200,
      headers: normalizeApiGatewayHeaders({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        ...corsHeaders(),
      }),
      body: String(body),
    };
  } catch (error: any) {
    console.error('Event attendees CSV error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
