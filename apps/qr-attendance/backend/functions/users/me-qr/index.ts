/**
 * 利用者用マイQRコード取得
 * GET /v1/users/me/qr
 * 利用者がスマホで表示するQR用のデータを返す。スタッフがこのQRをスキャンして打刻する。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserEmailFromRequest } from '../../../shared/utils/auth';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { getDB, withConnection } from '../../../shared/db/connection';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import * as crypto from 'crypto';

const QR_VALID_MS = 10 * 60 * 1000; // 10分（打刻APIと統一）

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    const email = getUserEmailFromRequest(event);
    if (!email) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    await initDBFromSecrets();
    const pool = getDB();
    const [users] = (await withConnection(pool, async (conn) =>
      conn.execute('SELECT email FROM users WHERE email = ?', [email])
    )) as any[];

    if (users.length === 0) {
      return errorResponse('NOT_FOUND', 'User not found', 404);
    }

    const secretKey = process.env.QR_SECRET_KEY || 'default-secret-key-change-in-production';
    const timestamp = Date.now();
    const qrPayload = { email, timestamp };
    const qrDataString = JSON.stringify(qrPayload);
    const qrCodeData = Buffer.from(qrDataString).toString('base64');
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(qrCodeData)
      .digest('hex');

    return successResponse({
      qr_code_data: qrCodeData,
      signature,
      expires_at: new Date(timestamp + QR_VALID_MS).toISOString(),
    });
  } catch (error: any) {
    console.error('Get user QR error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
