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
        const pool = (0, connection_1.getDB)();
        const data = await (0, connection_1.withConnection)(pool, async (conn) => {
            const [events] = (await conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId]));
            if (events.length === 0) {
                return { notFound: true };
            }
            const eventData = events[0];
            const [registrationCount] = (await conn.execute('SELECT COUNT(*) as count FROM registrations WHERE event_id = ?', [eventId]));
            const totalRegistrations = registrationCount[0]?.count || 0;
            const [attendanceCount] = (await conn.execute('SELECT COUNT(DISTINCT email) as count FROM attendance_logs WHERE event_id = ?', [eventId]));
            const totalAttendees = attendanceCount[0]?.count || 0;
            const [attendanceLogs] = (await conn.execute(`SELECT 
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
      ORDER BY in_time DESC`, [eventId]));
            const [timeSlotStats] = (await conn.execute(`SELECT 
        DATE_FORMAT(in_time, '%H:00') as time_slot,
        COUNT(*) as count
      FROM attendance_logs
      WHERE event_id = ?
      GROUP BY DATE_FORMAT(in_time, '%H:00')
      ORDER BY time_slot`, [eventId]));
            const [stayStats] = (await conn.execute(`SELECT 
        AVG(stay_minutes) as avg_stay_minutes,
        MIN(stay_minutes) as min_stay_minutes,
        MAX(stay_minutes) as max_stay_minutes
      FROM v_attendance_details
      WHERE event_id = ? AND stay_minutes IS NOT NULL`, [eventId]));
            return {
                notFound: false,
                eventData,
                totalRegistrations,
                totalAttendees,
                attendanceLogs,
                timeSlotStats,
                stayStats,
            };
        });
        if (data.notFound) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
        }
        const attendanceRate = data.totalRegistrations > 0
            ? ((data.totalAttendees / data.totalRegistrations) * 100).toFixed(1)
            : '0.0';
        return (0, response_1.successResponse)({
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
            attendance_logs: data.attendanceLogs.map((log) => ({
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
                time_slot_distribution: data.timeSlotStats.map((stat) => ({
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
    }
    catch (error) {
        console.error('Get attendance report error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
