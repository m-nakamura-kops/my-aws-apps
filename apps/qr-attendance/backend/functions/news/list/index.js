'use strict';
/**
 * GET /v1/news - お知らせ一覧（利用者・スタッフ・管理者共通・要ログイン）
 * 表示条件（厳密）:
 *   - COALESCE(is_published,1)=1（公開のみ）
 *   - published_at <= NOW()（未来予約は1秒でも前なら一切出さない）
 *   - expired_at IS NULL OR expired_at >= NOW()
 * 並び: 新着順（created_at DESC）
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
    const email = (0, auth_1.getUserEmailFromRequest)(event);
    if (!email) {
      return (0, response_1.errorResponse)('UNAUTHORIZED', 'Authentication required', 401);
    }

    const queryParams = event.queryStringParameters || {};
    let limit = queryParams.limit != null ? parseInt(queryParams.limit, 10) : 10;
    let page = queryParams.page != null ? parseInt(queryParams.page, 10) : 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 50) limit = 50;
    if (isNaN(page) || page < 1) page = 1;
    const offset = (page - 1) * limit;

    const db = (0, connection_1.getDB)();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    let totalCount = 0;
    let rows = [];

    try {
      const whereClause = ' WHERE COALESCE(is_published, 1) = 1 AND published_at <= ? AND (expired_at IS NULL OR expired_at >= ?)';
      const countSql = 'SELECT COUNT(*) as total FROM news' + whereClause;
      const [countResult] = await db.execute(countSql, [now, now]);
      totalCount = countResult[0]?.total ?? 0;
      const listSql = 'SELECT id, title, content, COALESCE(announcement_type, 1) AS announcement_type, published_at, expired_at, created_at, updated_at FROM news' +
        whereClause + ' ORDER BY created_at DESC LIMIT ' + limit + ' OFFSET ' + offset;
      const [listRows] = await db.execute(listSql, [now, now]);
      rows = listRows || [];
    } catch (schemaErr) {
      const msg = schemaErr && typeof schemaErr === 'object' && 'message' in schemaErr ? schemaErr.message : String(schemaErr);
      if (msg.indexOf('Unknown column') !== -1) {
        const whereLegacy = ' WHERE published_at <= ? AND (expired_at IS NULL OR expired_at >= ?)';
        const [countResult] = await db.execute('SELECT COUNT(*) as total FROM news' + whereLegacy, [now, now]);
        totalCount = countResult[0]?.total ?? 0;
        const [listRows] = await db.execute(
          'SELECT id, title, content, published_at, expired_at, created_at, updated_at FROM news' + whereLegacy + ' ORDER BY created_at DESC LIMIT ' + limit + ' OFFSET ' + offset,
          [now, now]
        );
        rows = (listRows || []).map((r) => ({ ...r, announcement_type: 1 }));
      } else {
        throw schemaErr;
      }
    }

    const hasNextPage = offset + rows.length < totalCount;

    return (0, response_1.successResponse)({
      news: rows || [],
      totalCount,
      hasNextPage,
    });
  } catch (error) {
    console.error('List news error:', error);
    const message = error && typeof error === 'object' && 'message' in error ? error.message : String(error);
    return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, message);
  }
}

exports.handler = handler;
