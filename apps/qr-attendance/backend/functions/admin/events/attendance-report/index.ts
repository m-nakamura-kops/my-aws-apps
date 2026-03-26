/**
 * イベント出席レポート取得Lambda関数
 * GET /v1/admin/events/{eventId}/attendance-report
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkAdminPermission } from '../../../../shared/utils/auth';

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

    const pool = getDB();

    const data = await withConnection(pool, async (conn) => {
      const [events] = (await conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId])) as any[];
      if (events.length === 0) {
        return { notFound: true as const };
      }
      const eventData = events[0];

      const [registrationCount] = (await conn.execute(
        'SELECT COUNT(*) as count FROM registrations WHERE event_id = ?',
        [eventId]
      )) as any[];
      const totalRegistrations = registrationCount[0]?.count || 0;

      const [attendanceCount] = (await conn.execute(
        'SELECT COUNT(DISTINCT email) as count FROM attendance_logs WHERE event_id = ?',
        [eventId]
      )) as any[];
      const totalAttendees = attendanceCount[0]?.count || 0;

      const [attendanceLogs] = (await conn.execute(
        `SELECT 
        log_id,
        email,
        user_name,
        in_time,
        out_time,
        stay_minutes,
        staff_email,
        staff_name
      FROM v_attendance_details
      WHERE event_id = ?
      ORDER BY in_time DESC`,
        [eventId]
      )) as any[];

      const [timeSlotStats] = (await conn.execute(
        `SELECT 
        DATE_FORMAT(in_time, '%H:00') as time_slot,
        COUNT(*) as count
      FROM attendance_logs
      WHERE event_id = ?
      GROUP BY DATE_FORMAT(in_time, '%H:00')
      ORDER BY time_slot`,
        [eventId]
      )) as any[];

      const [stayStats] = (await conn.execute(
        `SELECT 
        AVG(stay_minutes) as avg_stay_minutes,
        MIN(stay_minutes) as min_stay_minutes,
        MAX(stay_minutes) as max_stay_minutes
      FROM v_attendance_details
      WHERE event_id = ? AND stay_minutes IS NOT NULL`,
        [eventId]
      )) as any[];

      return {
        notFound: false as const,
        eventData,
        totalRegistrations,
        totalAttendees,
        attendanceLogs,
        timeSlotStats,
        stayStats,
      };
    });

    if (data.notFound) {
      return errorResponse('NOT_FOUND', 'Event not found', 404);
    }

    const attendanceRate =
      data.totalRegistrations > 0
        ? ((data.totalAttendees / data.totalRegistrations) * 100).toFixed(1)
        : '0.0';

    return successResponse({
      event_id: parseInt(eventId, 10),
      event_name: data.eventData.event_name,
      event_date: data.eventData.event_date,
      location: data.eventData.location,
      capacity: data.eventData.capacity,
      summary: {
        total_registrations: data.totalRegistrations,
        total_attendees: data.totalAttendees,
        attendance_rate: parseFloat(attendanceRate),
        no_show_count: data.totalRegistrations - data.totalAttendees,
      },
      attendance_logs: data.attendanceLogs.map((log: any) => ({
        log_id: log.log_id,
        email: log.email,
        user_name: log.user_name,
        in_time: log.in_time,
        out_time: log.out_time,
        stay_minutes: log.stay_minutes,
        staff_email: log.staff_email,
        staff_name: log.staff_name,
      })),
      statistics: {
        time_slot_distribution: data.timeSlotStats.map((stat: any) => ({
          time_slot: stat.time_slot,
          count: stat.count,
        })),
        stay_duration: data.stayStats[0]
          ? {
              avg_minutes: data.stayStats[0].avg_stay_minutes
                ? Math.round(data.stayStats[0].avg_stay_minutes)
                : null,
              min_minutes: data.stayStats[0].min_stay_minutes || null,
              max_minutes: data.stayStats[0].max_stay_minutes || null,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Get attendance report error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
