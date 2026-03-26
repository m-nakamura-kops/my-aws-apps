/**
 * QRコード打刻Lambda関数
 * POST /v1/users/attendance
 *
 * 退室時: 当該イベント・ユーザーで「in_time IS NOT NULL かつ out_time IS NULL」の行を UPDATE し out_time を埋める。
 *         併せて type=exit の行を INSERT（v_attendance_details の結合用）。
 * 入室時: 上記の開いている行が無ければ type=entry の行を INSERT（最新行の type だけでは判定しない）。
 * 時刻: すべて JST（Asia/Tokyo）の YYYY-MM-DD HH:mm:ss で RDS DATETIME と整合。
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getDB, withConnection, type Pool } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import { checkStaffOrAdminPermission } from '../../../shared/utils/auth';
import * as crypto from 'crypto';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ_TOKYO = 'Asia/Tokyo';

/** MySQL DATETIME として安全な形式（厳格） */
const MYSQL_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/**
 * JST の壁時計を `YYYY-MM-DD HH:mm:ss` で返す。
 * 空・不正・Invalid Date のときは再取得 → それでもダメなら UTC+9 のフォールバック。
 * out_time / in_time に空文字が入らないようにする。
 */
function nowJstMysqlDatetime(): string {
  const primary = dayjs().tz(TZ_TOKYO).format('YYYY-MM-DD HH:mm:ss');
  if (isValidMysqlDatetimeString(primary)) {
    return primary;
  }
  const retry = dayjs().tz(TZ_TOKYO).format('YYYY-MM-DD HH:mm:ss');
  if (isValidMysqlDatetimeString(retry)) {
    return retry;
  }
  const fallbackUtcPlus9 = dayjs.utc().add(9, 'hour').format('YYYY-MM-DD HH:mm:ss');
  if (isValidMysqlDatetimeString(fallbackUtcPlus9)) {
    return fallbackUtcPlus9;
  }
  const last = dayjs().format('YYYY-MM-DD HH:mm:ss');
  if (isValidMysqlDatetimeString(last)) {
    return last;
  }
  throw new Error('Failed to compute JST datetime for MySQL');
}

function isValidMysqlDatetimeString(s: unknown): s is string {
  if (s === undefined || s === null || typeof s !== 'string') return false;
  const t = s.trim();
  if (t === '' || t.includes('Invalid')) return false;
  if (!MYSQL_DATETIME_RE.test(t)) return false;
  const [datePart, timePart] = t.split(' ');
  if (!datePart || !timePart) return false;
  const [Y, M, D] = datePart.split('-').map((x) => parseInt(x, 10));
  const [h, m, sec] = timePart.split(':').map((x) => parseInt(x, 10));
  if (
    Number.isNaN(Y) ||
    Number.isNaN(M) ||
    Number.isNaN(D) ||
    Number.isNaN(h) ||
    Number.isNaN(m) ||
    Number.isNaN(sec)
  ) {
    return false;
  }
  if (Y < 1970 || Y > 2100 || M < 1 || M > 12 || D < 1 || D > 31) return false;
  if (h > 23 || m > 59 || sec > 59) return false;
  return true;
}

/** UPDATE / INSERT 直前に必ず通す（空・undefined を絶対にバインドしない） */
function requireJstDatetimeForBind(candidate: string | undefined | null, label: string): string {
  if (candidate !== undefined && candidate !== null && isValidMysqlDatetimeString(candidate)) {
    return candidate.trim();
  }
  const fresh = nowJstMysqlDatetime();
  if (!isValidMysqlDatetimeString(fresh)) {
    throw new Error(`Invalid datetime after refresh for ${label}`);
  }
  return fresh;
}

/** VARCHAR 系プレースホルダ用（undefined でプレースホルダがずれないよう常に文字列） */
function requireNonEmptyString(value: unknown, label: string): string {
  const s = value === undefined || value === null ? '' : String(value).trim();
  if (s === '') {
    throw new Error(`Missing required string for SQL bind: ${label}`);
  }
  return s;
}

const USER_QR_VALID_MS = 10 * 60 * 1000;
const QR_CLOCK_SKEW_MS = 60 * 1000;

function rowType(latest: Record<string, unknown> | undefined): string {
  if (!latest || latest.type == null) return '';
  const t = latest.type as unknown;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(t)) {
    return t.toString('utf8').trim().toLowerCase();
  }
  return String(t).trim().toLowerCase();
}

function isOutTimeEmpty(out: unknown): boolean {
  if (out == null || out === '') return true;
  if (out instanceof Date) return false;
  const s = String(out).trim();
  return s === '' || s === 'null' || s.startsWith('0000-00-00');
}

type PunchResult = {
  log_id: number;
  action: 'in' | 'out';
  in_time: string | null;
  out_time?: string | null;
  message: string;
};

async function fetchLatestAttendanceRow(
  pool: Pool,
  userEmail: string,
  eventId: number
): Promise<Record<string, unknown> | undefined> {
  return withConnection(pool, async (conn) => {
    const [rows] = (await conn.execute(
      'SELECT * FROM attendance_logs WHERE email = ? AND event_id = ? ORDER BY log_id DESC LIMIT 1',
      [userEmail, eventId]
    )) as any[];
    return rows[0] as Record<string, unknown> | undefined;
  });
}

/**
 * 当該イベント・ユーザーで「入室済み（in_time あり）かつ未退室（out_time NULL）」の行を1件取得。
 * 最新行の type に依存せず、開いているセッションのみ退室対象とする（初回が退室になる誤判定を防ぐ）。
 */
async function fetchOpenSessionRow(
  pool: Pool,
  userEmail: string,
  eventId: number
): Promise<{ log_id: number; in_time: string | null } | null> {
  return withConnection(pool, async (conn) => {
    const [rows] = (await conn.execute(
      `SELECT log_id, in_time FROM attendance_logs
       WHERE email = ? AND event_id = ?
         AND in_time IS NOT NULL
         AND out_time IS NULL
       ORDER BY log_id DESC
       LIMIT 1`,
      [userEmail, eventId]
    )) as any[];
    const r = rows[0];
    if (!r) return null;
    return { log_id: Number(r.log_id), in_time: (r.in_time as string) ?? null };
  });
}

async function ensureRegistrationForWalkIn(pool: Pool, userEmail: string, eventId: number): Promise<void> {
  await withConnection(pool, async (conn) => {
    const [existing] = (await conn.execute(
      'SELECT reg_id FROM registrations WHERE email = ? AND event_id = ? LIMIT 1',
      [userEmail, eventId]
    )) as any[];
    if (existing.length > 0) return;
    try {
      await conn.execute('INSERT INTO registrations (email, event_id) VALUES (?, ?)', [userEmail, eventId]);
    } catch (e: any) {
      const c = e?.code ?? e?.errno;
      if (c === 'ER_DUP_ENTRY' || c === 1062) return;
      throw e;
    }
  });
}

function isDup(e: any): boolean {
  const c = e?.code ?? e?.errno;
  return c === 'ER_DUP_ENTRY' || c === 1062;
}

/** DB 現在状態からレスポンスを組み立てる（冪等） */
async function punchResultFromDbState(pool: Pool, userEmail: string, eventId: number): Promise<PunchResult> {
  const latest = await fetchLatestAttendanceRow(pool, userEmail, eventId);
  if (!latest) {
    throw new Error('No attendance row after punch');
  }
  const t = rowType(latest);
  if (t === 'exit') {
    const [enRows] = (await withConnection(pool, async (conn) =>
      conn.execute(
        `SELECT log_id, in_time FROM attendance_logs WHERE email = ? AND event_id = ? AND type = 'entry' ORDER BY log_id DESC LIMIT 1`,
        [userEmail, eventId]
      )
    )) as any[];
    const en = enRows[0];
    return {
      log_id: Number(latest.log_id),
      action: 'out',
      in_time: en?.in_time ?? null,
      out_time: latest.out_time as string | null,
      message: '退室打刻が完了しました',
    };
  }
  // entry / レガシー: out_time が埋まっていれば退室済み（UPDATE 済みで exit 行より log_id が小さい場合）
  if (!isOutTimeEmpty(latest.out_time)) {
    const [exRows] = (await withConnection(pool, async (conn) =>
      conn.execute(
        `SELECT log_id, out_time FROM attendance_logs WHERE email = ? AND event_id = ? AND type = 'exit' ORDER BY log_id DESC LIMIT 1`,
        [userEmail, eventId]
      )
    )) as any[];
    const ex = exRows[0];
    const [enRows] = (await withConnection(pool, async (conn) =>
      conn.execute(
        `SELECT log_id, in_time FROM attendance_logs WHERE email = ? AND event_id = ? AND type = 'entry' ORDER BY log_id DESC LIMIT 1`,
        [userEmail, eventId]
      )
    )) as any[];
    const en = enRows[0];
    return {
      log_id: ex ? Number(ex.log_id) : Number(latest.log_id),
      action: 'out',
      in_time: (en?.in_time ?? latest.in_time) as string | null,
      out_time: (ex?.out_time ?? latest.out_time) as string | null,
      message: '退室打刻が完了しました',
    };
  }
  return {
    log_id: Number(latest.log_id),
    action: 'in',
    in_time: (latest.in_time as string | null) ?? null,
    message: '入室打刻が完了しました',
  };
}

async function punchEntryExitToggle(
  pool: Pool,
  userEmail: string,
  eventId: number,
  staffEmail: string,
  retryDepth = 0
): Promise<PunchResult> {
  if (retryDepth > 5) {
    throw new Error('Attendance punch retry limit exceeded');
  }

  const openSession = await fetchOpenSessionRow(pool, userEmail, eventId);
  const staffEmailBound = requireNonEmptyString(staffEmail, 'staff_email');

  if (openSession) {
    const entryLogId = openSession.log_id;
    const entryInTime = openSession.in_time;

    const outTimeForDb = requireJstDatetimeForBind(nowJstMysqlDatetime(), 'out_time (checkout UPDATE)');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 開いているセッション行のみ更新（in_time 必須・out_time NULL を再確認）
      const [upd] = (await conn.execute(
        `UPDATE attendance_logs
         SET out_time = ?, staff_email = ?, updated_at = CURRENT_TIMESTAMP
         WHERE log_id = ? AND email = ? AND event_id = ?
           AND in_time IS NOT NULL
           AND out_time IS NULL`,
        [outTimeForDb, staffEmailBound, entryLogId, userEmail, eventId]
      )) as any;

      if (upd.affectedRows === 0) {
        await conn.rollback();
        return punchEntryExitToggle(pool, userEmail, eventId, staffEmailBound, retryDepth + 1);
      }

      const outTimeInsert = requireJstDatetimeForBind(outTimeForDb, 'out_time (checkout INSERT exit row)');
      await conn.execute(
        `INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email)
         VALUES (?, ?, 'exit', NULL, ?, ?)`,
        [userEmail, eventId, outTimeInsert, staffEmailBound]
      );

      await conn.commit();

      return {
        log_id: entryLogId,
        action: 'out',
        in_time: entryInTime,
        out_time: outTimeInsert,
        message: '退室打刻が完了しました',
      };
    } catch (e: any) {
      try {
        await conn.rollback();
      } catch (_) {}

      if (isDup(e)) {
        return punchResultFromDbState(pool, userEmail, eventId);
      }
      throw e;
    } finally {
      conn.release();
    }
  }

  // 入室: in_time は DATETIME 文字列、out_time は SQL の NULL（プレースホルダは使わない）
  const inTimeForDb = requireJstDatetimeForBind(nowJstMysqlDatetime(), 'in_time (checkin INSERT)');
  try {
    return await withConnection(pool, async (conn) => {
      const [result] = (await conn.execute(
        `INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email)
         VALUES (?, ?, 'entry', ?, NULL, ?)`,
        [userEmail, eventId, inTimeForDb, staffEmailBound]
      )) as any[];
      return {
        log_id: result.insertId,
        action: 'in',
        in_time: inTimeForDb,
        message: '入室打刻が完了しました',
      };
    });
  } catch (e: any) {
    if (isDup(e)) {
      return punchResultFromDbState(pool, userEmail, eventId);
    }
    throw e;
  }
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }
    const body = JSON.parse(event.body);
    const qrData = body.qr_code_data || body.data;
    const signature = body.signature || body.sig;
    const eventIdParam = body.event_id;

    if (!qrData || !signature) {
      return errorResponse('BAD_REQUEST', 'qr_code_data and signature are required', 400);
    }

    const secretKey = process.env.QR_SECRET_KEY || 'default-secret-key-change-in-production';
    const expectedSignature = crypto.createHmac('sha256', secretKey).update(qrData).digest('hex');

    if (signature !== expectedSignature) {
      return errorResponse('UNAUTHORIZED', 'Invalid QR code signature', 401);
    }

    let qrCodeInfo: any;
    try {
      const decodedData = Buffer.from(qrData, 'base64').toString('utf8');
      qrCodeInfo = JSON.parse(decodedData);
    } catch (err) {
      return errorResponse('BAD_REQUEST', 'Invalid QR code data format', 400);
    }

    await initDBFromSecrets();
    const db = getDB();

    if (qrCodeInfo.email != null && eventIdParam != null) {
      const userEmail = String(qrCodeInfo.email);
      const qrTimestamp = Number(qrCodeInfo.timestamp);
      const eventId = typeof eventIdParam === 'number' ? eventIdParam : parseInt(String(eventIdParam), 10);

      const now = Date.now();
      const qrAge = now - qrTimestamp;
      if (qrAge > USER_QR_VALID_MS || qrAge < -QR_CLOCK_SKEW_MS) {
        return errorResponse('BAD_REQUEST', 'QR code has expired. Please show the latest QR again.', 400);
      }

      const staffPermission = await checkStaffOrAdminPermission(event);
      if (!staffPermission.authorized) {
        return errorResponse(
          staffPermission.statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
          staffPermission.error,
          staffPermission.statusCode
        );
      }
      const staffEmail = String(staffPermission.email ?? '').trim();
      if (!staffEmail) {
        return errorResponse('UNAUTHORIZED', 'Staff email missing from token', 401);
      }

      const [events] = (await withConnection(db, async (conn) =>
        conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId])
      )) as any[];
      if (events.length === 0) {
        return errorResponse('NOT_FOUND', 'Event not found', 404);
      }

      const [users] = (await withConnection(db, async (conn) =>
        conn.execute('SELECT * FROM users WHERE email = ?', [userEmail])
      )) as any[];
      if (users.length === 0) {
        return errorResponse('NOT_FOUND', 'User not found', 404);
      }

      await ensureRegistrationForWalkIn(db, userEmail, eventId);

      const punch = await punchEntryExitToggle(db, userEmail, eventId, staffEmail);
      return successResponse(punch);
    }

    const eventId = qrCodeInfo.event_id;
    const qrTimestamp = qrCodeInfo.timestamp;
    const userEmail = body.email;

    if (eventId == null || qrTimestamp == null || !userEmail) {
      return errorResponse(
        'BAD_REQUEST',
        'Invalid request. For staff scan: send qr_code_data, signature, and event_id with staff Authorization. For user QR: show QR from "My QR" page and let staff scan it.',
        400
      );
    }

    const now = Date.now();
    const qrAge = now - qrTimestamp;
    if (qrAge > 24 * 60 * 60 * 1000) {
      return errorResponse('BAD_REQUEST', 'QR code has expired', 400);
    }

    const [events] = (await withConnection(db, async (conn) =>
      conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId])
    )) as any[];
    if (events.length === 0) {
      return errorResponse('NOT_FOUND', 'Event not found', 404);
    }

    const [users] = (await withConnection(db, async (conn) =>
      conn.execute('SELECT * FROM users WHERE email = ?', [userEmail])
    )) as any[];
    if (users.length === 0) {
      return errorResponse('NOT_FOUND', 'User not found', 404);
    }

    await ensureRegistrationForWalkIn(db, userEmail, eventId);

    const punch = await punchEntryExitToggle(db, userEmail, eventId, userEmail);
    return successResponse(punch);
  } catch (error: any) {
    console.error('Attendance punch error:', error);
    return errorResponse('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
  }
};
