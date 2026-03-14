/**
 * イベント参加者一覧取得Lambda関数
 * GET /v1/admin/events/{eventId}/participants
 * 権限マトリクス: 出席確認画面 — スタッフ・管理者は全員の打刻状況、利用者は自身の打刻状況のみ閲覧可。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkStaffOrAdminPermission } from '../../../../shared/utils/auth';
import { isStaffOrAdmin } from '../../../../shared/utils/role-check';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    await initDBFromSecrets();
    const permission = await checkStaffOrAdminPermission(event);
    if (!permission.authorized) {
      return errorResponse(
        permission.statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
        permission.error,
        permission.statusCode
      );
    }
    const canViewAll = isStaffOrAdmin(permission.roleFlag);
    const requestEmail = permission.email;

    // パスパラメータからeventIdを取得
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return errorResponse('BAD_REQUEST', 'eventId is required', 400);
    }

    // クエリパラメータの取得
    const queryParams = event.queryStringParameters || {};
    let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
    let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;

    if (isNaN(limit) || limit < 1 || limit > 1000) limit = 100;
    if (isNaN(offset) || offset < 0) offset = 0;

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

    // 利用者は自身の参加状況のみ取得。スタッフ・管理者は全参加者を取得
    let participants: any[];
    let total: number;
    if (canViewAll) {
      const [rows] = await db.execute(
        `SELECT 
          email,
          name_kanji,
          name_kana,
          registration_date
        FROM v_event_participants
        WHERE event_id = ?
        ORDER BY registration_date DESC
        LIMIT ${limit} OFFSET ${offset}`,
        [eventId]
      ) as any[];
      participants = rows || [];
      const [countResult] = await db.execute(
        'SELECT COUNT(*) as total FROM v_event_participants WHERE event_id = ?',
        [eventId]
      ) as any[];
      total = countResult[0]?.total || 0;
    } else {
      const [rows] = await db.execute(
        `SELECT 
          email,
          name_kanji,
          name_kana,
          registration_date
        FROM v_event_participants
        WHERE event_id = ? AND email = ?
        LIMIT 1`,
        [eventId, requestEmail]
      ) as any[];
      participants = rows || [];
      total = participants.length;
    }

    // ユーザー詳細情報を取得（電話番号など）
    const participantsWithDetails = await Promise.all(
      participants.map(async (participant: any) => {
        const [users] = await db.execute(
          'SELECT tel, org_id, role_flag FROM users WHERE email = ?',
          [participant.email]
        ) as any[];
        
        return {
          email: participant.email,
          name_kanji: participant.name_kanji,
          name_kana: participant.name_kana,
          tel: users[0]?.tel || null,
          org_id: users[0]?.org_id || null,
          role_flag: users[0]?.role_flag || null,
          registration_date: participant.registration_date,
        };
      })
    );

    return successResponse({
      event_id: parseInt(eventId, 10),
      event_name: eventData.event_name,
      event_date: eventData.event_date,
      participants: participantsWithDetails,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('Get participants error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
