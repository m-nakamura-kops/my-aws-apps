/**
 * QRコード生成Lambda関数
 * GET /v1/admin/events/{eventId}/qr
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkAdminPermission } from '../../../../shared/utils/auth';
import * as crypto from 'crypto';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // CORSプリフライトリクエスト対応
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    // 管理者権限チェック
    await initDBFromSecrets();
    const permissionCheck = await checkAdminPermission(event);
    if (!permissionCheck.authorized) {
      return errorResponse('FORBIDDEN', permissionCheck.error || 'Admin access required', 403);
    }

    // パスパラメータからeventIdを取得
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return errorResponse('BAD_REQUEST', 'eventId is required', 400);
    }

    // データベース接続を取得（既に初期化済み）
    const db = getDB();

    // イベントの存在確認
    const [events] = await db.execute(
      'SELECT * FROM events WHERE event_id = ?',
      [eventId]
    ) as any[];

    if (events.length === 0) {
      return errorResponse('NOT_FOUND', 'Event not found', 404);
    }

    const eventData = events[0];

    // QRコードデータを生成（イベントIDとシークレットキーを含む）
    // 本番環境では、より安全な方法でシークレットを管理する必要があります
    const secretKey = process.env.QR_SECRET_KEY || 'default-secret-key-change-in-production';
    const timestamp = Date.now();
    const qrData = {
      event_id: parseInt(eventId, 10),
      event_name: eventData.event_name,
      timestamp: timestamp,
    };

    // データをJSON文字列化してBase64エンコード
    const qrDataString = JSON.stringify(qrData);
    const qrCodeData = Buffer.from(qrDataString).toString('base64');

    // 署名を生成（改ざん防止のため）
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(qrCodeData)
      .digest('hex');

    // QRコード用のURLを生成（フロントエンドでスキャン時に使用）
    // APIエンドポイントのURLにデータと署名を含める
    const region = process.env.AWS_REGION || 'ap-northeast-1';
    const apiId = process.env.API_ID || 'xcv8usy3dh'; // API GatewayのID（環境変数から取得）
    const apiBaseUrl = `https://${apiId}.execute-api.${region}.amazonaws.com/prod`;
    const qrCodeUrl = `${apiBaseUrl}/v1/users/attendance?data=${encodeURIComponent(qrCodeData)}&sig=${signature}`;

    return successResponse({
      event_id: parseInt(eventId, 10),
      event_name: eventData.event_name,
      qr_code_data: qrCodeData,
      qr_code_url: qrCodeUrl,
      signature: signature,
      expires_at: new Date(timestamp + 24 * 60 * 60 * 1000).toISOString(), // 24時間有効
    });
  } catch (error: any) {
    console.error('Generate QR code error:', error);

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
