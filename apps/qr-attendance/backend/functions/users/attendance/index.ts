/**
 * QRコード打刻Lambda関数
 * POST /v1/users/attendance
 *
 * 退室時: 当該イベント・ユーザーで「in_time IS NOT NULL かつ out_time IS NULL」の行を UPDATE し out_time を埋める。
 *         新規行は INSERT しない（1入退室 = 1レコード）。in_time は一切上書きしない。
 * 入室時: 開いている行が無ければ type=entry の行を INSERT。
 * 時刻: DB の NOW() のみを唯一の時計とする（セッション time_zone は +09:00 に固定済み）。
 *       Lambda 側の new Date() は打刻時刻に使わないため、数秒のズレや逆転が発生しない。
 * 逆転防止: out_time は GREATEST(NOW(), in_time) で必ず in_time 以降になる。
 * 連打防止: 直近 DEDUP_WINDOW_SECONDS 秒以内の同一ユーザー・イベントの打刻は同じスキャンとみなし、
 *           入室直後の即時退室や、退室直後の再入室 INSERT を行わない。
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection, type Pool } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import { checkStaffOrAdminPermission } from '../../../shared/utils/auth';
import * as crypto from 'crypto';

/**
 * 同一ユーザー・イベントで、この秒数以内の連続スキャンは「同じ1回のスキャン」とみなす。
 * カメラが同じQRを複数フレームで読む／利用者QRが更新されて debounce が効かない場合の
 * 「入室した直後に即退室」「退室した直後に再入室」を防ぐ。
 */
const DEDUP_WINDOW_SECONDS = 15;

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

type OpenSessionRow = {
  log_id: number;
  in_time: string | null;
  /** DB の NOW() 基準で in_time からの経過秒。負値は in_time が未来（時計ズレ）を意味する */
  in_age_seconds: number;
};

type ClosedSessionRow = {
  log_id: number;
  in_time: string | null;
  out_time: string | null;
  /** DB の NOW() 基準で out_time からの経過秒 */
  out_age_seconds: number;
};

/**
 * 当該イベント・ユーザーで「入室済み（in_time あり）かつ未退室（out_time NULL）」の行を1件取得。
 * 最新行の type に依存せず、開いているセッションのみ退室対象とする（初回が退室になる誤判定を防ぐ）。
 * 経過秒は DB の NOW() で算出し、Lambda 側の時計と混ぜない。
 */
async function fetchOpenSessionRow(
  pool: Pool,
  userEmail: string,
  eventId: number
): Promise<OpenSessionRow | null> {
  return withConnection(pool, async (conn) => {
    const [rows] = (await conn.execute(
      `SELECT log_id, in_time, TIMESTAMPDIFF(SECOND, in_time, NOW()) AS in_age_seconds
       FROM attendance_logs
       WHERE email = ? AND event_id = ?
         AND in_time IS NOT NULL
         AND out_time IS NULL
       ORDER BY log_id DESC
       LIMIT 1`,
      [userEmail, eventId]
    )) as any[];
    const r = rows[0];
    if (!r) return null;
    return {
      log_id: Number(r.log_id),
      in_time: (r.in_time as string) ?? null,
      in_age_seconds: Number(r.in_age_seconds ?? 0),
    };
  });
}

/** 直近の「退室済み」行を1件取得（退室直後の重複スキャンで新規入室 INSERT を防ぐため） */
async function fetchLatestClosedSessionRow(
  pool: Pool,
  userEmail: string,
  eventId: number
): Promise<ClosedSessionRow | null> {
  return withConnection(pool, async (conn) => {
    const [rows] = (await conn.execute(
      `SELECT log_id, in_time, out_time, TIMESTAMPDIFF(SECOND, out_time, NOW()) AS out_age_seconds
       FROM attendance_logs
       WHERE email = ? AND event_id = ?
         AND out_time IS NOT NULL
       ORDER BY log_id DESC
       LIMIT 1`,
      [userEmail, eventId]
    )) as any[];
    const r = rows[0];
    if (!r) return null;
    return {
      log_id: Number(r.log_id),
      in_time: (r.in_time as string) ?? null,
      out_time: (r.out_time as string) ?? null,
      out_age_seconds: Number(r.out_age_seconds ?? 0),
    };
  });
}

/** 書き込み後の確定値を DB から読み直す（JST 文字列のまま返す） */
async function fetchRowById(
  pool: Pool,
  logId: number
): Promise<{ in_time: string | null; out_time: string | null } | null> {
  return withConnection(pool, async (conn) => {
    const [rows] = (await conn.execute(
      'SELECT in_time, out_time FROM attendance_logs WHERE log_id = ? LIMIT 1',
      [logId]
    )) as any[];
    const r = rows[0];
    if (!r) return null;
    return { in_time: (r.in_time as string) ?? null, out_time: (r.out_time as string) ?? null };
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
  if (!isOutTimeEmpty(latest.out_time)) {
    return {
      log_id: Number(latest.log_id),
      action: 'out',
      in_time: (latest.in_time as string | null) ?? null,
      out_time: latest.out_time as string | null,
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

    // 入室直後（または in_time が未来にズレている）場合は同一スキャンの重複とみなし、退室にしない
    if (openSession.in_age_seconds < DEDUP_WINDOW_SECONDS) {
      return {
        log_id: entryLogId,
        action: 'in',
        in_time: openSession.in_time,
        message: '入室打刻が完了しました',
      };
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 開いているセッション行のみ更新。in_time は絶対に書き換えない。
      // out_time は GREATEST(NOW(), in_time) で必ず in_time 以降になり、逆転しない。
      const [upd] = (await conn.execute(
        `UPDATE attendance_logs
         SET out_time = GREATEST(NOW(), in_time), staff_email = ?, updated_at = CURRENT_TIMESTAMP
         WHERE log_id = ? AND email = ? AND event_id = ?
           AND in_time IS NOT NULL
           AND out_time IS NULL`,
        [staffEmailBound, entryLogId, userEmail, eventId]
      )) as any;

      if (upd.affectedRows === 0) {
        // 並行リクエストが先に閉じた場合は DB の現在状態を返す（新規 INSERT はしない）
        await conn.rollback();
        return punchResultFromDbState(pool, userEmail, eventId);
      }

      await conn.commit();

      const saved = await fetchRowById(pool, entryLogId);
      return {
        log_id: entryLogId,
        action: 'out',
        in_time: saved?.in_time ?? openSession.in_time,
        out_time: saved?.out_time ?? null,
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

  // 退室直後の重複スキャンでは新しい入室行を作らず、直前の退室結果を返す
  const latestClosed = await fetchLatestClosedSessionRow(pool, userEmail, eventId);
  if (latestClosed && latestClosed.out_age_seconds < DEDUP_WINDOW_SECONDS) {
    return {
      log_id: latestClosed.log_id,
      action: 'out',
      in_time: latestClosed.in_time,
      out_time: latestClosed.out_time,
      message: '退室打刻が完了しました',
    };
  }

  // 入室: in_time も DB の NOW()（JST）を使い、Lambda 側の時計は使わない
  try {
    return await withConnection(pool, async (conn) => {
      const [result] = (await conn.execute(
        `INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email)
         VALUES (?, ?, 'entry', NOW(), NULL, ?)`,
        [userEmail, eventId, staffEmailBound]
      )) as any[];
      const logId = Number(result.insertId);
      const [rows] = (await conn.execute(
        'SELECT in_time FROM attendance_logs WHERE log_id = ? LIMIT 1',
        [logId]
      )) as any[];
      return {
        log_id: logId,
        action: 'in',
        in_time: (rows[0]?.in_time as string) ?? null,
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
