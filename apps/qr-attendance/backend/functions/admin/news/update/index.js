'use strict';
/**
 * PUT /v1/admin/news/{id} - お知らせ更新（管理者・スタッフのみ）
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
    const id = event.pathParameters?.id;
    if (!id) {
      return (0, response_1.errorResponse)('BAD_REQUEST', 'id is required', 400);
    }
    if (!event.body) {
      return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
    }
    const body = JSON.parse(event.body);
    const { title, content, published_at, expired_at } = body;

    const db = (0, connection_1.getDB)();
    const [existing] = await db.execute('SELECT id FROM news WHERE id = ?', [id]);
    if (existing.length === 0) {
      return (0, response_1.errorResponse)('NOT_FOUND', 'News not found', 404);
    }

    const updates = [];
    const values = [];
    if (title !== undefined) {
      if (title === null || String(title).trim() === '') {
        return (0, response_1.errorResponse)('BAD_REQUEST', 'title must not be empty', 400);
      }
      updates.push('title = ?');
      values.push(String(title).trim());
    }
    if (content !== undefined) {
      if (content === null || String(content).trim() === '') {
        return (0, response_1.errorResponse)('BAD_REQUEST', 'content must not be empty', 400);
      }
      updates.push('content = ?');
      values.push(String(content).trim());
    }
    if (published_at !== undefined) {
      const d = new Date(published_at);
      if (isNaN(d.getTime())) {
        return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid published_at format', 400);
      }
      updates.push('published_at = ?');
      values.push(d.toISOString().slice(0, 19).replace('T', ' '));
    }
    if (expired_at !== undefined) {
      if (expired_at == null || expired_at === '') {
        updates.push('expired_at = ?');
        values.push(null);
      } else {
        const d = new Date(expired_at);
        if (isNaN(d.getTime())) {
          return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid expired_at format', 400);
        }
        updates.push('expired_at = ?');
        values.push(d.toISOString().slice(0, 19).replace('T', ' '));
      }
    }
    if (updates.length === 0) {
      return (0, response_1.successResponse)({ message: 'No changes' });
    }
    values.push(id);
    await db.execute('UPDATE news SET ' + updates.join(', ') + ' WHERE id = ?', values);
    const [rows] = await db.execute('SELECT id, title, content, published_at, expired_at, created_at, updated_at FROM news WHERE id = ?', [id]);
    const row = rows && rows[0];
    const newsItem = row ? {
      id: row.id,
      title: row.title,
      content: row.content,
      published_at: row.published_at,
      expired_at: row.expired_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } : null;
    return (0, response_1.successResponse)({ news: newsItem });
  } catch (error) {
    console.error('Update news error:', error);
    const message = error && typeof error === 'object' && 'message' in error ? error.message : String(error);
    return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, message);
  }
}

exports.handler = handler;
