'use strict';
/**
 * GET /v1/news - お知らせ一覧（利用者・スタッフ・管理者共通・要ログイン）
 * 条件: published_at <= NOW() AND (expired_at >= NOW() OR expired_at IS NULL)
 * 並び: published_at DESC
 * ページネーション: limit (default 10, 50可), page → totalCount, hasNextPage
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
    const whereClause = ' WHERE published_at <= ? AND (expired_at IS NULL OR expired_at >= ?)';
    const countSql = 'SELECT COUNT(*) as total FROM news' + whereClause;
    const [countResult] = await db.execute(countSql, [now, now]);
    const totalCount = countResult[0]?.total ?? 0;

    const listSql = 'SELECT id, title, content, published_at, expired_at, created_at, updated_at FROM news' +
      whereClause + ' ORDER BY published_at DESC LIMIT ' + limit + ' OFFSET ' + offset;
    const [rows] = await db.execute(listSql, [now, now]);

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
