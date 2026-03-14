'use strict';
/**
 * GET /v1/users/schedule - 自分のスケジュール（申込イベント + is_registered / is_attended）
 * 認証: 要ログイン。month: YYYY-MM（任意、省略時は当月）。
 */
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');

function getMonthRange(monthStr) {
  const now = new Date();
  const year = monthStr ? parseInt(monthStr.slice(0, 4), 10) : now.getFullYear();
  const month = monthStr ? parseInt(monthStr.slice(5, 7), 10) - 1 : now.getMonth();
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const startStr = start.toISOString().slice(0, 19).replace('T', ' ');
  const endStr = end.toISOString().slice(0, 19).replace('T', ' ');
  const monthLabel = monthStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return { startStr, endStr, monthLabel };
}

async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return (0, response_1.corsResponse)();
  }
  try {
    await (0, secrets_1.initDBFromSecrets)();
    const email = (0, auth_1.getUserEmailFromRequest)(event);
    if (!email) {
      return (0, response_1.errorResponse)('UNAUTHORIZED', 'Authentication required', 401);
    }

    const queryParams = event.queryStringParameters || {};
    const monthStr = queryParams.month;
    if (monthStr != null && monthStr !== '' && !/^\d{4}-\d{2}$/.test(monthStr)) {
      return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid month format. Use YYYY-MM', 400);
    }

    const { startStr, endStr, monthLabel } = getMonthRange(monthStr || undefined);
    const db = (0, connection_1.getDB)();

    const sql = `SELECT
  e.event_id,
  e.event_name,
  e.event_date,
  e.location,
  e.capacity,
  e.summary,
  1 AS is_registered,
  CASE WHEN al.log_id IS NOT NULL THEN 1 ELSE 0 END AS is_attended
FROM registrations r
INNER JOIN events e ON e.event_id = r.event_id
LEFT JOIN attendance_logs al ON al.event_id = r.event_id AND al.email = r.email
WHERE r.email = ?
  AND e.event_date BETWEEN ? AND ?
ORDER BY e.event_date ASC`;

    const [rows] = await db.execute(sql, [email, startStr, endStr]);

    const schedule = (rows || []).map((r) => ({
      event_id: r.event_id,
      event_name: r.event_name,
      event_date: r.event_date,
      location: r.location,
      capacity: r.capacity,
      summary: r.summary,
      is_registered: true,
      is_attended: Boolean(r.is_attended),
    }));

    return (0, response_1.successResponse)({ schedule, month: monthLabel });
  } catch (error) {
    console.error('Schedule list error:', error);
    const message = error && typeof error === 'object' && 'message' in error ? error.message : String(error);
    return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, message);
  }
}

exports.handler = handler;
