/**
 * Lambda関数のサンプル実装
 * このファイルは実装の参考用です
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB } from '../../shared/db/connection';
import { successResponse, errorResponse, corsResponse } from '../../shared/utils/response';

/**
 * サンプル: ユーザー情報取得
 * GET /v1/users/me
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // CORSプリフライトリクエスト対応
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    // 認証トークンの検証（実装が必要）
    // const token = event.headers.Authorization?.replace('Bearer ', '');
    // await verifyToken(token);

    // クエリパラメータ取得
    const email = event.queryStringParameters?.email;
    if (!email) {
      return errorResponse('BAD_REQUEST', 'email parameter is required', 400);
    }

    // データベース接続
    const db = getDB();
    
    // ユーザー情報取得
    const [rows] = await db.execute(
      'SELECT email, name_kanji, name_kana, org_id FROM users WHERE email = ?',
      [email]
    );

    const users = rows as any[];
    if (users.length === 0) {
      return errorResponse('NOT_FOUND', 'User not found', 404);
    }

    const user = users[0];

    // QRコードデータ生成（実装が必要）
    const qrCodeData = generateQRCodeData(user.email);

    // レスポンス
    return successResponse({
      userId: user.email,
      userName: user.name_kanji,
      orgId: user.org_id,
      qrCodeData,
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
};

/**
 * QRコードデータ生成（実装が必要）
 */
function generateQRCodeData(email: string): string {
  // TODO: QRコード生成ロジックを実装
  // 例: JSON形式のデータをBase64エンコード
  const data = {
    email,
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(data)).toString('base64');
}
