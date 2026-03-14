/**
 * イベント出席レポート取得Lambda関数
 * GET /v1/admin/events/{eventId}/attendance-report
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB } from '../../../../shared/db/connection';
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

    // 参加申込数
    const [registrationCount] = await db.execute(
      'SELECT COUNT(*) as count FROM registrations WHERE event_id = ?',
      [eventId]
    ) as any[];
    const totalRegistrations = registrationCount[0]?.count || 0;

    // 出席者数（打刻履歴があるユーザー数）
    const [attendanceCount] = await db.execute(
      'SELECT COUNT(DISTINCT email) as count FROM attendance_logs WHERE event_id = ?',
      [eventId]
    ) as any[];
    const totalAttendees = attendanceCount[0]?.count || 0;

    // 出席率の計算
    const attendanceRate = totalRegistrations > 0 
      ? ((totalAttendees / totalRegistrations) * 100).toFixed(1)
      : '0.0';

    // 打刻履歴の詳細（ビューを使用）
    const [attendanceLogs] = await db.execute(
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
    ) as any[];

    // 出席状況の集計（時間帯別）
    const [timeSlotStats] = await db.execute(
      `SELECT 
        DATE_FORMAT(in_time, '%H:00') as time_slot,
        COUNT(*) as count
      FROM attendance_logs
      WHERE event_id = ?
      GROUP BY DATE_FORMAT(in_time, '%H:00')
      ORDER BY time_slot`,
      [eventId]
    ) as any[];

    // 滞在時間の統計
    const [stayStats] = await db.execute(
      `SELECT 
        AVG(stay_minutes) as avg_stay_minutes,
        MIN(stay_minutes) as min_stay_minutes,
        MAX(stay_minutes) as max_stay_minutes
      FROM v_attendance_details
      WHERE event_id = ? AND stay_minutes IS NOT NULL`,
      [eventId]
    ) as any[];

    return successResponse({
      event_id: parseInt(eventId, 10),
      event_name: eventData.event_name,
      event_date: eventData.event_date,
      location: eventData.location,
      capacity: eventData.capacity,
      summary: {
        total_registrations: totalRegistrations,
        total_attendees: totalAttendees,
        attendance_rate: parseFloat(attendanceRate),
        no_show_count: totalRegistrations - totalAttendees,
      },
      attendance_logs: attendanceLogs.map((log: any) => ({
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
        time_slot_distribution: timeSlotStats.map((stat: any) => ({
          time_slot: stat.time_slot,
          count: stat.count,
        })),
        stay_duration: stayStats[0] ? {
          avg_minutes: stayStats[0].avg_stay_minutes 
            ? Math.round(stayStats[0].avg_stay_minutes) 
            : null,
          min_minutes: stayStats[0].min_stay_minutes || null,
          max_minutes: stayStats[0].max_stay_minutes || null,
        } : null,
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
