"use strict";
/**
 * イベント更新Lambda関数
 * PUT /v1/admin/events/{eventId}
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
        // リクエストボディの解析
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const { event_name, event_date, location, capacity, summary } = JSON.parse(event.body);
        // データベース接続を取得（既に初期化済み）
        const db = (0, connection_1.getDB)();
        // イベントの存在確認
        const [existingEvents] = await db.execute('SELECT * FROM events WHERE event_id = ?', [eventId]);
        if (existingEvents.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
        }
        // 更新フィールドの構築
        const updateFields = [];
        const updateValues = [];
        if (event_name !== undefined) {
            updateFields.push('event_name = ?');
            updateValues.push(event_name);
        }
        if (event_date !== undefined) {
            const eventDateObj = new Date(event_date);
            if (isNaN(eventDateObj.getTime())) {
                return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid event_date format', 400);
            }
            const eventDateForDb = eventDateObj.toISOString().slice(0, 19).replace('T', ' ');
            updateFields.push('event_date = ?');
            updateValues.push(eventDateForDb);
        }
        if (location !== undefined) {
            updateFields.push('location = ?');
            updateValues.push(location);
        }
        if (capacity !== undefined) {
            updateFields.push('capacity = ?');
            updateValues.push(capacity);
        }
        if (summary !== undefined) {
            updateFields.push('summary = ?');
            updateValues.push(summary);
        }
        if (updateFields.length === 0) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'No fields to update', 400);
        }
        updateValues.push(eventId);
        // イベント更新
        await db.execute(`UPDATE events SET ${updateFields.join(', ')} WHERE event_id = ?`, updateValues);
        // 更新されたイベントを取得
        const [updatedEvents] = await db.execute('SELECT * FROM events WHERE event_id = ?', [eventId]);
        return (0, response_1.successResponse)({
            event: updatedEvents[0],
        });
    }
    catch (error) {
        console.error('Update event error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
