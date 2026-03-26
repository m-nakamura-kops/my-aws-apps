'use strict';
/**
 * POST /v1/admin/news - お知らせ作成（管理者・スタッフのみ）
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
    if (!event.body) {
      return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
    }
    const body = JSON.parse(event.body);
    const { title, content, is_published, announcement_type, published_at, expired_at } = body;
    if (!title || title.trim() === '') {
      return (0, response_1.errorResponse)('BAD_REQUEST', 'title is required', 400);
    }
    if (!content || content.trim() === '') {
      return (0, response_1.errorResponse)('BAD_REQUEST', 'content is required', 400);
    }
    if (!published_at) {
      return (0, response_1.errorResponse)('BAD_REQUEST', 'published_at is required', 400);
    }
    const publishedAt = new Date(published_at);
    if (isNaN(publishedAt.getTime())) {
      return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid published_at format', 400);
    }
    const publishedAtDb = publishedAt.toISOString().slice(0, 19).replace('T', ' ');
    let expiredAtDb = null;
    if (expired_at != null && expired_at !== '') {
      const expiredAt = new Date(expired_at);
      if (isNaN(expiredAt.getTime())) {
        return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid expired_at format', 400);
      }
      expiredAtDb = expiredAt.toISOString().slice(0, 19).replace('T', ' ');
    }
    const isPublished = is_published === true || is_published === 1 || (is_published !== false && is_published !== 0);
    const typeVal = announcement_type === 2 || announcement_type === '2' || announcement_type === 'important' ? 2 : 1;

    const db = (0, connection_1.getDB)();
    const [result] = await db.execute(
      'INSERT INTO news (title, content, is_published, announcement_type, published_at, expired_at) VALUES (?, ?, ?, ?, ?, ?)',
      [String(title).trim(), String(content).trim(), isPublished ? 1 : 0, typeVal, publishedAtDb, expiredAtDb]
    );
    const id = Number(result.insertId);
    if (!Number.isInteger(id) || id < 1) {
      return (0, response_1.errorResponse)('INTERNAL_ERROR', 'Insert failed', 500);
    }
    const [rows] = await db.execute('SELECT id, title, content, COALESCE(is_published,1) AS is_published, COALESCE(announcement_type,1) AS announcement_type, published_at, expired_at, created_at, updated_at FROM news WHERE id = ?', [id]);
    const row = rows && rows[0];
    const newsItem = row ? {
      id: row.id,
      title: row.title,
      content: row.content,
      is_published: row.is_published === 1,
      announcement_type: row.announcement_type,
      published_at: row.published_at,
      expired_at: row.expired_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } : null;
    return (0, response_1.successResponse)({ id, news: newsItem }, 201);
  } catch (error) {
    console.error('Create news error:', error);
    const message = error && typeof error === 'object' && 'message' in error ? error.message : String(error);
    return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, message);
  }
}

exports.handler = handler;
