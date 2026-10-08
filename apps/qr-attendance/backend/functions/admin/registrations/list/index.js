'use strict';

/**
 * 管理者用：全申込一覧取得（横断・時系列）
 * GET /v1/admin/registrations
 */
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');

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
    const queryParams = event.queryStringParameters || {};
    let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
    let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
    const eventId = queryParams.event_id;
    const emailFilter = queryParams.email;
    if (isNaN(limit) || limit < 1 || limit > 1000) limit = 100;
    if (isNaN(offset) || offset < 0) offset = 0;
    const db = (0, connection_1.getDB)();
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
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];
    if (eventId) {
      query += ' AND r.event_id = ?';
      params.push(eventId);
      countParams.push(eventId);
    }
    if (emailFilter) {
      query += ' AND r.email LIKE ?';
      const pattern = `%${emailFilter}%`;
      params.push(pattern);
      countParams.push(pattern);
    }
    query += ` ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await db.execute(query, params);
    let countQuery = 'SELECT COUNT(*) as total FROM registrations r WHERE 1=1';
    if (eventId) countQuery += ' AND r.event_id = ?';
    if (emailFilter) countQuery += ' AND r.email LIKE ?';
    const [countResult] = await db.execute(countQuery, countParams);
    const total = countResult[0]?.total || 0;
    const registrations = (rows || []).map((r) => ({
      reg_id: r.reg_id,
      email: r.email,
      user_name: r.user_name,
      event_id: r.event_id,
      event_name: r.event_name,
      event_date: r.event_date,
      location: r.location,
      capacity: r.capacity,
      registration_date: r.registration_date,
    }));
    return (0, response_1.successResponse)({
      registrations,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (error) {
    console.error('Admin registrations list error:', error);
    return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
  }
};

exports.handler = handler;
