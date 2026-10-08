'use strict';
/**
 * GET /v1/admin/news - お知らせ一覧（管理者・スタッフ用・全件）
 * 公開・非公開・期間外を区別して返す。created_at DESC。
 */
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');

async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return (0, response_1.corsResponse)();
  }
  try {
    await (0, secrets_1.initDBFromSecrets)();
    const permissionCheck = await (0, auth_1.checkStaffOrAdminPermission)(event);
    if (!permissionCheck.authorized) {
      return (0, response_1.errorResponse)('FORBIDDEN', permissionCheck.error || 'Staff or admin access required', 403);
    }

    const queryParams = event.queryStringParameters || {};
    let limit = queryParams.limit != null ? parseInt(queryParams.limit, 10) : 100;
    let offset = queryParams.offset != null ? parseInt(queryParams.offset, 10) : 0;
    if (isNaN(limit) || limit < 1 || limit > 1000) limit = 100;
    if (isNaN(offset) || offset < 0) offset = 0;

    const db = (0, connection_1.getDB)();
    let total = 0;
    let rows = [];

    try {
      const [countResult] = await db.execute('SELECT COUNT(*) as total FROM news');
      total = countResult[0]?.total ?? 0;
      const listSql = `SELECT id, title, content, COALESCE(is_published, 1) AS is_published, COALESCE(announcement_type, 1) AS announcement_type, published_at, expired_at, created_at, updated_at FROM news ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      const [listRows] = await db.execute(listSql);
      rows = listRows || [];
    } catch (schemaErr) {
      const msg = schemaErr && typeof schemaErr === 'object' && 'message' in schemaErr ? schemaErr.message : String(schemaErr);
      if (msg.indexOf('Unknown column') !== -1) {
        const [countResult] = await db.execute('SELECT COUNT(*) as total FROM news');
        total = countResult[0]?.total ?? 0;
        const [listRows] = await db.execute(`SELECT id, title, content, published_at, expired_at, created_at, updated_at FROM news ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`);
        rows = (listRows || []).map((r) => ({ ...r, is_published: 1, announcement_type: 1 }));
      } else {
        throw schemaErr;
      }
    }

    const news = rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      is_published: r.is_published === 1,
      announcement_type: r.announcement_type != null ? r.announcement_type : 1,
      published_at: r.published_at,
      expired_at: r.expired_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return (0, response_1.successResponse)({
      news,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (error) {
    console.error('Admin news list error:', error);
    const message = error && typeof error === 'object' && 'message' in error ? error.message : String(error);
    return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, message);
  }
}

exports.handler = handler;
