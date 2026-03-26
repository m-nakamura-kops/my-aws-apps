/**
 * イベント参加者一覧取得Lambda関数
 * GET /v1/admin/events/{eventId}/participants
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../../shared/db/connection';
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

    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return errorResponse('BAD_REQUEST', 'eventId is required', 400);
    }

    const queryParams = event.queryStringParameters || {};
    let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
    let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;

    if (isNaN(limit) || limit < 1 || limit > 1000) limit = 100;
    if (isNaN(offset) || offset < 0) offset = 0;

    const pool = getDB();

    const payload = await withConnection(pool, async (conn) => {
      const [events] = (await conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId])) as any[];
      if (events.length === 0) {
        return { notFound: true as const };
      }
      const eventData = events[0];

      let participants: any[];
      let total: number;
      if (canViewAll) {
        const [rows] = (await conn.execute(
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
        )) as any[];
        participants = rows || [];
        const [countResult] = (await conn.execute(
          'SELECT COUNT(*) as total FROM v_event_participants WHERE event_id = ?',
          [eventId]
        )) as any[];
        total = countResult[0]?.total || 0;
      } else {
        const [rows] = (await conn.execute(
          `SELECT 
          email,
          name_kanji,
          name_kana,
          registration_date
        FROM v_event_participants
        WHERE event_id = ? AND email = ?
        LIMIT 1`,
          [eventId, requestEmail]
        )) as any[];
        participants = rows || [];
        total = participants.length;
      }

      const participantsWithDetails = [];
      for (const participant of participants) {
        const [users] = (await conn.execute(
          'SELECT tel, org_id, role_flag FROM users WHERE email = ?',
          [participant.email]
        )) as any[];
        participantsWithDetails.push({
          email: participant.email,
          name_kanji: participant.name_kanji,
          name_kana: participant.name_kana,
          tel: users[0]?.tel || null,
          org_id: users[0]?.org_id || null,
          role_flag: users[0]?.role_flag || null,
          registration_date: participant.registration_date,
        });
      }

      return {
        notFound: false as const,
        eventData,
        participantsWithDetails,
        total,
        limit,
        offset,
      };
    });

    if (payload.notFound) {
      return errorResponse('NOT_FOUND', 'Event not found', 404);
    }

    return successResponse({
      event_id: parseInt(eventId, 10),
      event_name: payload.eventData.event_name,
      event_date: payload.eventData.event_date,
      participants: payload.participantsWithDetails,
      pagination: {
        total: payload.total,
        limit: payload.limit,
        offset: payload.offset,
        hasMore: payload.offset + payload.limit < payload.total,
      },
    });
  } catch (error: any) {
    console.error('Get participants error:', error);
    return errorResponse('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
  }
};
