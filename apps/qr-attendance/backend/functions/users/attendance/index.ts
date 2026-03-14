/**
 * QRコード打刻Lambda関数
 * POST /v1/users/attendance
 *
 * 【スタッフスキャン方式】スタッフが利用者のスマホに表示されたQRをスキャンして打刻する。
 * リクエスト: { qr_code_data, signature, event_id } + Authorization: Bearer <スタッフのトークン>
 * QR内容: { email（利用者）, timestamp }（有効10分）
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import { getUserEmailFromRequest, checkStaffOrAdminPermission } from '../../../shared/utils/auth';
import * as crypto from 'crypto';

const USER_QR_VALID_MS = 10 * 60 * 1000; // 利用者QR 10分
const QR_CLOCK_SKEW_MS = 60 * 1000; // サーバー時刻ずれの許容（1分）

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
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(qrData)
      .digest('hex');

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

    // スタッフスキャン方式: QRに email と timestamp のみ（event_id はリクエストで渡す）
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
      const staffEmail = staffPermission.email;

      const [events] = await db.execute('SELECT * FROM events WHERE event_id = ?', [eventId]) as any[];
      if (events.length === 0) {
        return errorResponse('NOT_FOUND', 'Event not found', 404);
      }

      const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [userEmail]) as any[];
      if (users.length === 0) {
        return errorResponse('NOT_FOUND', 'User not found', 404);
      }

      // 申込済みチェック: 未申込の場合は 403
      const [registrations] = await db.execute(
        'SELECT * FROM registrations WHERE email = ? AND event_id = ?',
        [userEmail, eventId]
      ) as any[];
      if (registrations.length === 0) {
        return errorResponse('FORBIDDEN', 'User is not registered for this event', 403);
      }

      const [existingLogs] = await db.execute(
        'SELECT * FROM attendance_logs WHERE email = ? AND event_id = ? ORDER BY in_time DESC LIMIT 1',
        [userEmail, eventId]
      ) as any[];

      const nowDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

      if (existingLogs.length === 0 || existingLogs[0].out_time) {
        const [result] = await db.execute(
          `INSERT INTO attendance_logs (email, event_id, in_time, staff_email) VALUES (?, ?, ?, ?)`,
          [userEmail, eventId, nowDateTime, staffEmail]
        ) as any[];
        return successResponse({
          log_id: result.insertId,
          action: 'in',
          in_time: nowDateTime,
          message: '入室打刻が完了しました',
        });
      } else {
        await db.execute(
          'UPDATE attendance_logs SET out_time = ? WHERE log_id = ?',
          [nowDateTime, existingLogs[0].log_id]
        );
        return successResponse({
          log_id: existingLogs[0].log_id,
          action: 'out',
          in_time: existingLogs[0].in_time,
          out_time: nowDateTime,
          message: '退室打刻が完了しました',
        });
      }
    }

    // 旧方式（イベントQRを利用者がスキャン）: QRに event_id と timestamp があり、body に email
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

    const [events] = await db.execute('SELECT * FROM events WHERE event_id = ?', [eventId]) as any[];
    if (events.length === 0) {
      return errorResponse('NOT_FOUND', 'Event not found', 404);
    }

    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [userEmail]) as any[];
    if (users.length === 0) {
      return errorResponse('NOT_FOUND', 'User not found', 404);
    }

    // 申込済みチェック: 未申込の場合は 403
    const [registrations] = await db.execute(
      'SELECT * FROM registrations WHERE email = ? AND event_id = ?',
      [userEmail, eventId]
    ) as any[];
    if (registrations.length === 0) {
      return errorResponse('FORBIDDEN', 'User is not registered for this event', 403);
    }

    const [existingLogs] = await db.execute(
      'SELECT * FROM attendance_logs WHERE email = ? AND event_id = ? ORDER BY in_time DESC LIMIT 1',
      [userEmail, eventId]
    ) as any[];

    const nowDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (existingLogs.length === 0 || existingLogs[0].out_time) {
      const [result] = await db.execute(
        `INSERT INTO attendance_logs (email, event_id, in_time, staff_email) VALUES (?, ?, ?, ?)`,
        [userEmail, eventId, nowDateTime, userEmail]
      ) as any[];
      return successResponse({
        log_id: result.insertId,
        action: 'in',
        in_time: nowDateTime,
        message: '入室打刻が完了しました',
      });
    } else {
      await db.execute(
        'UPDATE attendance_logs SET out_time = ? WHERE log_id = ?',
        [nowDateTime, existingLogs[0].log_id]
      );
      return successResponse({
        log_id: existingLogs[0].log_id,
        action: 'out',
        in_time: existingLogs[0].in_time,
        out_time: nowDateTime,
        message: '退室打刻が完了しました',
      });
    }
  } catch (error: any) {
    console.error('Attendance punch error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
