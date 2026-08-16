'use strict';
/**
 * GET /v1/events - スタッフ・管理者用イベント一覧
 */
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const role_check_1 = require('./shared/utils/role-check');

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
    const roleFlag = await (0, auth_1.getUserRoleFlag)(email);
    // 認証済みなら誰でもイベント一覧を取得可能（利用者の申込窓口・スタッフの打刻スキャン用）

    const queryParams = event.queryStringParameters || {};
    let limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 100;
    let offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
    if (isNaN(limit) || limit < 1 || limit > 1000) limit = 100;
    if (isNaN(offset) || offset < 0) offset = 0;
    const limitInt = Math.min(1000, Math.max(1, Math.floor(Number(limit)) || 100));
    const offsetInt = Math.max(0, Math.floor(Number(offset)) || 0);

    const db = (0, connection_1.getDB)();
    // LIMIT/OFFSET は検証済み整数のため SQL に直接埋め込み（mysql2 のプレースホルダでエラーになる場合の対策）
    const listSql = `SELECT event_id, event_name, event_date, location, capacity, summary, created_at, updated_at FROM events ORDER BY event_date DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;
    const [events] = await db.execute(listSql);
    const [countResult] = await db.execute('SELECT COUNT(*) as total FROM events');
    const total = countResult[0]?.total || 0;

    return (0, response_1.successResponse)({
      events: events || [],
      pagination: { total, limit: limitInt, offset: offsetInt, hasMore: offsetInt + limitInt < total },
    });
  } catch (error) {
    console.error('List events error:', error);
    const message = error && typeof error === 'object' && 'message' in error ? error.message : String(error);
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    const isDbError = (message && (
      /ECONNREFUSED|ETIMEDOUT|Access denied|ER_ACCESS_DENIED|ENOTFOUND|connect/.test(message)
    )) || (code && ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(String(code)));
    const userMessage = isDbError
      ? 'データベースに接続できません。MySQLの起動と .env の DB_* 設定を確認してください。'
      : 'An internal error occurred';
    return (0, response_1.errorResponse)('INTERNAL_ERROR', userMessage, 500, message);
  }
}

exports.handler = handler;
