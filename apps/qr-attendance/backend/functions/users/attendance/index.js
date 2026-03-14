'use strict';
/**
 * QRコード打刻 Lambda
 * POST /v1/users/attendance
 * スタッフスキャン: body = { qr_code_data, signature, event_id } + Authorization（スタッフ）
 * 旧方式: body = { qr_code_data, signature, email }（QRに event_id 含む）
 */
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const role_check_1 = require('./shared/utils/role-check');
const crypto = require('crypto');

const USER_QR_VALID_MS = 10 * 60 * 1000; // 利用者QR 10分
const QR_CLOCK_SKEW_MS = 60 * 1000;     // サーバー時刻ずれの許容（1分）

async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return (0, response_1.corsResponse)();
  }
  try {
    if (!event.body) {
      return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
    }
    const body = JSON.parse(event.body);
    const qrData = body.qr_code_data || body.data;
    const signature = body.signature || body.sig;
    const eventIdParam = body.event_id;

    if (!qrData || !signature) {
      return (0, response_1.errorResponse)('BAD_REQUEST', 'qr_code_data and signature are required', 400);
    }

    const secretKey = process.env.QR_SECRET_KEY || 'default-secret-key-change-in-production';
    const expectedSig = crypto.createHmac('sha256', secretKey).update(qrData).digest('hex');
    if (signature !== expectedSig) {
      return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid QR code signature', 401);
    }

    let qrCodeInfo;
    try {
      qrCodeInfo = JSON.parse(Buffer.from(qrData, 'base64').toString('utf8'));
    } catch (err) {
      return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid QR code data format', 400);
    }

    await (0, secrets_1.initDBFromSecrets)();
    const db = (0, connection_1.getDB)();

    // スタッフスキャン: QRに email + timestamp、body に event_id
    if (qrCodeInfo.email != null && eventIdParam != null) {
      const userEmail = String(qrCodeInfo.email);
      const qrTimestamp = Number(qrCodeInfo.timestamp);
      const eventId = typeof eventIdParam === 'number' ? eventIdParam : parseInt(String(eventIdParam), 10);

      const now = Date.now();
      const qrAge = now - qrTimestamp;
      if (qrAge > USER_QR_VALID_MS || qrAge < -QR_CLOCK_SKEW_MS) {
        return (0, response_1.errorResponse)('BAD_REQUEST', 'QR code has expired. Please show the latest QR again.', 400);
      }

      const staffEmail = (0, auth_1.getUserEmailFromRequest)(event);
      if (!staffEmail) {
        return (0, response_1.errorResponse)('UNAUTHORIZED', 'Staff authentication required', 401);
      }
      const staffRole = await (0, auth_1.getUserRoleFlag)(staffEmail);
      if (!(0, role_check_1.isStaffOrAdmin)(staffRole)) {
        return (0, response_1.errorResponse)('FORBIDDEN', 'Only staff or admin can scan user QR for attendance', 403);
      }

      const [events] = await db.execute('SELECT * FROM events WHERE event_id = ?', [eventId]);
      if (events.length === 0) {
        return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
      }
      const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [userEmail]);
      if (users.length === 0) {
        return (0, response_1.errorResponse)('NOT_FOUND', 'User not found', 404);
      }

      const [registrations] = await db.execute(
        'SELECT * FROM registrations WHERE email = ? AND event_id = ?',
        [userEmail, eventId]
      );
      if (registrations.length === 0) {
        return (0, response_1.errorResponse)('FORBIDDEN', 'User is not registered for this event', 403);
      }

      const [existingLogs] = await db.execute(
        'SELECT * FROM attendance_logs WHERE email = ? AND event_id = ? ORDER BY in_time DESC LIMIT 1',
        [userEmail, eventId]
      );
      const nowDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

      if (existingLogs.length === 0 || existingLogs[0].out_time) {
        const [result] = await db.execute(
          'INSERT INTO attendance_logs (email, event_id, in_time, staff_email) VALUES (?, ?, ?, ?)',
          [userEmail, eventId, nowDateTime, staffEmail]
        );
        return (0, response_1.successResponse)({
          log_id: result.insertId,
          action: 'in',
          in_time: nowDateTime,
          message: '入室打刻が完了しました',
        });
      } else {
        await db.execute('UPDATE attendance_logs SET out_time = ? WHERE log_id = ?', [nowDateTime, existingLogs[0].log_id]);
        return (0, response_1.successResponse)({
          log_id: existingLogs[0].log_id,
          action: 'out',
          in_time: existingLogs[0].in_time,
          out_time: nowDateTime,
          message: '退室打刻が完了しました',
        });
      }
    }

    // 旧方式: QRに event_id + timestamp、body に email
    const eventId = qrCodeInfo.event_id;
    const qrTimestamp = qrCodeInfo.timestamp;
    const userEmail = body.email;
    if (eventId == null || qrTimestamp == null || !userEmail) {
      return (0, response_1.errorResponse)(
        'BAD_REQUEST',
        'Invalid request. For staff scan: send qr_code_data, signature, and event_id with staff Authorization.',
        400
      );
    }
    const now = Date.now();
    if (now - qrTimestamp > 24 * 60 * 60 * 1000) {
      return (0, response_1.errorResponse)('BAD_REQUEST', 'QR code has expired', 400);
    }

    const [events] = await db.execute('SELECT * FROM events WHERE event_id = ?', [eventId]);
    if (events.length === 0) {
      return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
    }
    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [userEmail]);
    if (users.length === 0) {
      return (0, response_1.errorResponse)('NOT_FOUND', 'User not found', 404);
    }

    const [registrations] = await db.execute(
      'SELECT * FROM registrations WHERE email = ? AND event_id = ?',
      [userEmail, eventId]
    );
    if (registrations.length === 0) {
      return (0, response_1.errorResponse)('FORBIDDEN', 'User is not registered for this event', 403);
    }

    const [existingLogs] = await db.execute(
      'SELECT * FROM attendance_logs WHERE email = ? AND event_id = ? ORDER BY in_time DESC LIMIT 1',
      [userEmail, eventId]
    );
    const nowDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (existingLogs.length === 0 || existingLogs[0].out_time) {
      const [result] = await db.execute(
        'INSERT INTO attendance_logs (email, event_id, in_time, staff_email) VALUES (?, ?, ?, ?)',
        [userEmail, eventId, nowDateTime, userEmail]
      );
      return (0, response_1.successResponse)({
        log_id: result.insertId,
        action: 'in',
        in_time: nowDateTime,
        message: '入室打刻が完了しました',
      });
    } else {
      await db.execute('UPDATE attendance_logs SET out_time = ? WHERE log_id = ?', [nowDateTime, existingLogs[0].log_id]);
      return (0, response_1.successResponse)({
        log_id: existingLogs[0].log_id,
        action: 'out',
        in_time: existingLogs[0].in_time,
        out_time: nowDateTime,
        message: '退室打刻が完了しました',
      });
    }
  } catch (error) {
    console.error('Attendance punch error:', error);
    return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
  }
}

exports.handler = handler;
