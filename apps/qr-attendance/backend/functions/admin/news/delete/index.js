'use strict';
/**
 * DELETE /v1/admin/news/{id} - お知らせ削除（管理者・スタッフのみ）
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

    const db = (0, connection_1.getDB)();
    const [existing] = await db.execute('SELECT id FROM news WHERE id = ?', [id]);
    if (existing.length === 0) {
      return (0, response_1.errorResponse)('NOT_FOUND', 'News not found', 404);
    }
    await db.execute('DELETE FROM news WHERE id = ?', [id]);
    return (0, response_1.successResponse)({ message: 'News deleted successfully', id: parseInt(id, 10) });
  } catch (error) {
    console.error('Delete news error:', error);
    const message = error && typeof error === 'object' && 'message' in error ? error.message : String(error);
    return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, message);
  }
}

exports.handler = handler;
