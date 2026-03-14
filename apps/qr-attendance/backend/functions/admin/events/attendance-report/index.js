"use strict";
/**
 * イベント出席レポート取得Lambda関数
 * GET /v1/admin/events/{eventId}/attendance-report
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const handler = async (event) => {
    // CORSプリフライトリクエスト対応
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        // 管理者権限チェック
        await (0, secrets_1.initDBFromSecrets)();
        const permissionCheck = await (0, auth_1.checkAdminPermission)(event);
        if (!permissionCheck.authorized) {
            return (0, response_1.errorResponse)('FORBIDDEN', permissionCheck.error || 'Admin access required', 403);
        }
        // パスパラメータからeventIdを取得
        const eventId = event.pathParameters?.eventId;
        if (!eventId) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'eventId is required', 400);
        }
        // データベース接続を取得（既に初期化済み）
        const db = (0, connection_1.getDB)();
        // イベントの存在確認
        const [events] = await db.execute('SELECT * FROM events WHERE event_id = ?', [eventId]);
        if (events.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
        }
        const eventData = events[0];
        // 参加申込数
        const [registrationCount] = await db.execute('SELECT COUNT(*) as count FROM registrations WHERE event_id = ?', [eventId]);
        const totalRegistrations = registrationCount[0]?.count || 0;
        // 出席者数（打刻履歴があるユーザー数）
        const [attendanceCount] = await db.execute('SELECT COUNT(DISTINCT email) as count FROM attendance_logs WHERE event_id = ?', [eventId]);
        const totalAttendees = attendanceCount[0]?.count || 0;
        // 出席率の計算
        const attendanceRate = totalRegistrations > 0
            ? ((totalAttendees / totalRegistrations) * 100).toFixed(1)
            : '0.0';
        // 打刻履歴の詳細（ビューを使用）
        const [attendanceLogs] = await db.execute(`SELECT 
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
      ORDER BY in_time DESC`, [eventId]);
        // 出席状況の集計（時間帯別）
        const [timeSlotStats] = await db.execute(`SELECT 
        DATE_FORMAT(in_time, '%H:00') as time_slot,
        COUNT(*) as count
      FROM attendance_logs
      WHERE event_id = ?
      GROUP BY DATE_FORMAT(in_time, '%H:00')
      ORDER BY time_slot`, [eventId]);
        // 滞在時間の統計
        const [stayStats] = await db.execute(`SELECT 
        AVG(stay_minutes) as avg_stay_minutes,
        MIN(stay_minutes) as min_stay_minutes,
        MAX(stay_minutes) as max_stay_minutes
      FROM v_attendance_details
      WHERE event_id = ? AND stay_minutes IS NOT NULL`, [eventId]);
        return (0, response_1.successResponse)({
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
            attendance_logs: attendanceLogs.map((log) => ({
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
                time_slot_distribution: timeSlotStats.map((stat) => ({
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
    }
    catch (error) {
        console.error('Get attendance report error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
