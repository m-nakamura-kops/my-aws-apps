'use strict';
/**
 * 利用者用マイQR取得 GET /v1/users/me/qr
 */
const auth_1 = require('./shared/utils/auth');
const secrets_1 = require('./shared/db/secrets');
const connection_1 = require('./shared/db/connection');
const response_1 = require('./shared/utils/response');
const crypto = require('crypto');

const QR_VALID_MS = 10 * 60 * 1000; // 10分（打刻APIと統一）

async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return (0, response_1.corsResponse)();
  }
  try {
    const email = (0, auth_1.getUserEmailFromRequest)(event);
    if (!email) {
      return (0, response_1.errorResponse)('UNAUTHORIZED', 'Authentication required', 401);
    }

    await (0, secrets_1.initDBFromSecrets)();
    const db = (0, connection_1.getDB)();
    const [users] = await db.execute('SELECT email FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return (0, response_1.errorResponse)('NOT_FOUND', 'User not found', 404);
    }

    const secretKey = process.env.QR_SECRET_KEY || 'default-secret-key-change-in-production';
    const timestamp = Date.now();
    const qrPayload = { email, timestamp };
    const qrCodeData = Buffer.from(JSON.stringify(qrPayload)).toString('base64');
    const signature = crypto.createHmac('sha256', secretKey).update(qrCodeData).digest('hex');

    return (0, response_1.successResponse)({
      qr_code_data: qrCodeData,
      signature,
      expires_at: new Date(timestamp + QR_VALID_MS).toISOString(),
    });
  } catch (error) {
    console.error('Get user QR error:', error);
    return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
  }
}

exports.handler = handler;
