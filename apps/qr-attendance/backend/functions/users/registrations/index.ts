/**
 * 申込一覧取得Lambda関数
 * GET /v1/users/registrations
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // CORSプリフライトリクエスト対応
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    // クエリパラメータの取得
    const queryParams = event.queryStringParameters || {};
    const email = queryParams.email;
    const eventId = queryParams.event_id;
    let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
    let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;

    // 値の検証
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      limit = 100;
    }
    if (isNaN(offset) || offset < 0) {
      offset = 0;
    }

    if (!email) {
      return errorResponse('BAD_REQUEST', 'email parameter is required', 400);
    }

    // データベース接続を初期化
    await initDBFromSecrets();
    const db = getDB();

    // 申込一覧取得（ビューを使用して詳細情報を含める）
    let query = `
      SELECT 
        r.reg_id,
        r.email,
        u.name_kanji AS user_name,
        r.event_id,
        e.event_name,
        e.event_date,
        e.location,
        e.capacity,
        r.created_at AS registration_date
      FROM registrations r
      INNER JOIN users u ON r.email = u.email
      INNER JOIN events e ON r.event_id = e.event_id
      WHERE r.email = ?
    `;
    const params: any[] = [email];

    if (eventId) {
      query += ' AND r.event_id = ?';
      params.push(eventId);
    }

    query += ` ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [registrations] = await db.execute(query, params) as any[];

    // 総件数を取得
    let countQuery = `
      SELECT COUNT(*) as total
      FROM registrations r
      WHERE r.email = ?
    `;
    const countParams: any[] = [email];

    if (eventId) {
      countQuery += ' AND r.event_id = ?';
      countParams.push(eventId);
    }

    const [countResult] = await db.execute(countQuery, countParams) as any[];
    const total = countResult[0]?.total || 0;

    return successResponse({
      registrations: registrations.map((reg: any) => ({
        reg_id: reg.reg_id,
        email: reg.email,
        user_name: reg.user_name,
        event_id: reg.event_id,
        event_name: reg.event_name,
        event_date: reg.event_date,
        location: reg.location,
        capacity: reg.capacity,
        registration_date: reg.registration_date,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('Get registrations error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
