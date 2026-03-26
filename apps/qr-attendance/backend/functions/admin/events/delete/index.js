"use strict";
/**
 * イベント削除Lambda関数
 * DELETE /v1/admin/events/{eventId}
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const handler = async (event) => {
    // CORSプリフライトリクエスト対応
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        // 管理者権限チェック
        await (0, secrets_1.initDBFromSecrets)();
        const permissionCheck = await (0, auth_1.checkAdminPermission)(event);
        if (!permissionCheck.authorized) {
            return (0, response_1.errorResponse)('FORBIDDEN', permissionCheck.error || 'Admin access required', 403);
        }
        // パスパラメータからeventIdを取得
        const eventId = event.pathParameters?.eventId;
        if (!eventId) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'eventId is required', 400);
        }
        const pool = (0, connection_1.getDB)();
        const found = await (0, connection_1.withConnection)(pool, async (conn) => {
            const [existingEvents] = (await conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId]));
            if (existingEvents.length === 0) {
                return false;
            }
            await conn.execute('DELETE FROM events WHERE event_id = ?', [eventId]);
            return true;
        });
        if (!found) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
        }
        return (0, response_1.successResponse)({
            message: 'Event deleted successfully',
            eventId: parseInt(eventId, 10),
        });
    }
    catch (error) {
        console.error('Delete event error:', error);
        // 外部キー制約エラーの処理
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return (0, response_1.errorResponse)('CONFLICT', 'Cannot delete event: it has related records', 409);
        }
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
