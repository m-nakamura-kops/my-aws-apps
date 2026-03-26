"use strict";
/**
 * イベント出席レポート取得Lambda関数
 * GET /v1/admin/events/{eventId}/attendance-report
 *
 * - attendance_logs を取得し、同一ユーザーの entry 行と直後の exit 行を1セッションにマージして返す
 * - 時刻は JSON では ISO 文字列または null（NULL・不正・1970 系は null に落とす）
 * - 時間帯集計は入室が記録された entry 行（in_time IS NOT NULL）のみカウント
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
function rowType(t) {
    if (t == null)
        return '';
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(t))
        return t.toString('utf8').trim().toLowerCase();
    return String(t).trim().toLowerCase();
}
/** DB / ドライバからの値を「無効な日時」として扱う */
function isInvalidDatetime(v) {
    if (v == null || v === '')
        return true;
    if (v instanceof Date) {
        const ms = v.getTime();
        if (Number.isNaN(ms))
            return true;
        if (v.getFullYear() < 1980)
            return true;
        return false;
    }
    const s = String(v).trim();
    if (s === '' || s === 'null' || s.startsWith('0000-00-00'))
        return true;
    const d = new Date(s);
    if (Number.isNaN(d.getTime()))
        return true;
    if (d.getFullYear() < 1980)
        return true;
    return false;
}
function toIsoOrNull(v) {
    if (isInvalidDatetime(v))
        return null;
    if (v instanceof Date)
        return v.toISOString();
    const d = new Date(String(v).trim());
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 1980)
        return null;
    return d.toISOString();
}
function diffStayMinutes(inT, outT) {
    if (isInvalidDatetime(inT) || isInvalidDatetime(outT))
        return null;
    const a = inT instanceof Date ? inT.getTime() : new Date(String(inT).trim()).getTime();
    const b = outT instanceof Date ? outT.getTime() : new Date(String(outT).trim()).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a)
        return null;
    return Math.round((b - a) / 60000);
}
function isEmptyOut(out) {
    if (out == null || out === '')
        return true;
    if (out instanceof Date)
        return isInvalidDatetime(out);
    const s = String(out).trim();
    return s === '' || s.startsWith('0000-00-00');
}
/**
 * log_id 昇順で走査し、entry(またはレガシー1行)と直後の exit 行を1行にまとめる。
 */
function mergeAttendanceSessions(rows) {
    const sorted = [...rows].sort((a, b) => Number(a.log_id) - Number(b.log_id));
    const merged = [];
    let i = 0;
    while (i < sorted.length) {
        const r = sorted[i];
        const typ = rowType(r.type);
        if (typ === 'exit') {
            const outIso = toIsoOrNull(r.out_time);
            merged.push({
                log_id: Number(r.log_id),
                email: r.email,
                user_name: r.user_name,
                in_time: null,
                out_time: outIso,
                stay_minutes: null,
                staff_email: r.staff_email,
                staff_name: r.staff_name,
            });
            i += 1;
            continue;
        }
        let inTimeRaw = r.in_time;
        let outTimeRaw = r.out_time;
        let consumedExit = false;
        if (isEmptyOut(outTimeRaw) && i + 1 < sorted.length) {
            const n = sorted[i + 1];
            if (rowType(n.type) === 'exit' && n.email === r.email) {
                outTimeRaw = n.out_time;
                consumedExit = true;
            }
        }
        const inIso = toIsoOrNull(inTimeRaw);
        const outIso = toIsoOrNull(outTimeRaw);
        const stay = !isInvalidDatetime(inTimeRaw) && !isInvalidDatetime(outTimeRaw)
            ? diffStayMinutes(inTimeRaw, outTimeRaw)
            : null;
        merged.push({
            log_id: Number(r.log_id),
            email: r.email,
            user_name: r.user_name,
            in_time: inIso,
            out_time: outIso,
            stay_minutes: stay,
            staff_email: r.staff_email,
            staff_name: r.staff_name,
        });
        i += consumedExit ? 2 : 1;
    }
    merged.sort((a, b) => {
        const ta = a.in_time ? new Date(a.in_time).getTime() : 0;
        const tb = b.in_time ? new Date(b.in_time).getTime() : 0;
        return tb - ta;
    });
    return merged;
}
function computeStayStats(minutes) {
    const vals = minutes.filter((m) => m != null && Number.isFinite(m) && m >= 0);
    if (vals.length === 0) {
        return { avg_minutes: null, min_minutes: null, max_minutes: null };
    }
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
        avg_minutes: Math.round(sum / vals.length),
        min_minutes: Math.min(...vals),
        max_minutes: Math.max(...vals),
    };
}
const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        await (0, secrets_1.initDBFromSecrets)();
        const permissionCheck = await (0, auth_1.checkAdminPermission)(event);
        if (!permissionCheck.authorized) {
            return (0, response_1.errorResponse)('FORBIDDEN', permissionCheck.error || 'Admin access required', 403);
        }
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
            const [rawRows] = (await conn.execute(`SELECT 
          al.log_id,
          al.email,
          al.type,
          al.in_time,
          al.out_time,
          al.staff_email,
          u.name_kanji AS user_name,
          st.name_kanji AS staff_name
        FROM attendance_logs al
        INNER JOIN users u ON al.email = u.email
        INNER JOIN users st ON al.staff_email = st.email
        WHERE al.event_id = ?
        ORDER BY al.log_id ASC`, [eventId]));
            const mergedLogs = mergeAttendanceSessions(rawRows);
            const [timeSlotStats] = (await conn.execute(`SELECT 
          DATE_FORMAT(in_time, '%H:00') AS time_slot,
          COUNT(*) AS count
        FROM attendance_logs
        WHERE event_id = ?
          AND in_time IS NOT NULL
          AND COALESCE(NULLIF(TRIM(type), ''), 'entry') = 'entry'
        GROUP BY DATE_FORMAT(in_time, '%H:00')
        ORDER BY time_slot`, [eventId]));
            const stayFromMerged = computeStayStats(mergedLogs.map((m) => m.stay_minutes));
            return {
                notFound: false,
                eventData,
                totalRegistrations,
                totalAttendees,
                mergedLogs,
                timeSlotStats,
                stayFromMerged,
            };
        });
        if (data.notFound) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
        }
        const attendanceRate = data.totalRegistrations > 0
            ? ((data.totalAttendees / data.totalRegistrations) * 100).toFixed(1)
            : '0.0';
        const slotRows = data.timeSlotStats;
        const slotCounts = slotRows.map((row) => Number(row.count) || 0);
        const slotTotalPunches = slotCounts.reduce((s, c) => s + c, 0);
        const slotMaxCount = slotCounts.length > 0 ? Math.max(...slotCounts, 1) : 1;
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
                entry_punch_count: slotTotalPunches,
            },
            attendance_logs: data.mergedLogs,
            statistics: {
                time_slot_distribution: slotRows.map((stat) => ({
                    time_slot: stat.time_slot,
                    count: Number(stat.count) || 0,
                })),
                time_slot_max_count: slotMaxCount,
                stay_duration: data.stayFromMerged,
            },
        });
    }
    catch (error) {
        console.error('Get attendance report error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
