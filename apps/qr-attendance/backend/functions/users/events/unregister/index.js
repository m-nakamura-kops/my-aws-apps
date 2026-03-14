"use strict";
/**
 * イベント参加取消Lambda関数
 * DELETE /v1/users/events/{eventId}/register
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const handler = async (event) => {
    // CORSプリフライトリクエスト対応
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        // パスパラメータからeventIdを取得
        const eventId = event.pathParameters?.eventId;
        if (!eventId) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'eventId is required', 400);
        }
        // クエリパラメータまたはリクエストボディからemailを取得
        let email;
        if (event.queryStringParameters?.email) {
            email = event.queryStringParameters.email;
        }
        else if (event.body) {
            const body = JSON.parse(event.body);
            email = body.email;
        }
        if (!email) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'email is required', 400);
        }
        // データベース接続を初期化
        await (0, secrets_1.initDBFromSecrets)();
        const db = (0, connection_1.getDB)();
        // イベントの存在確認
        const [events] = await db.execute('SELECT * FROM events WHERE event_id = ?', [eventId]);
        if (events.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
        }
        // 申込の存在確認
        const [registrations] = await db.execute('SELECT * FROM registrations WHERE email = ? AND event_id = ?', [email, eventId]);
        if (registrations.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Registration not found', 404);
        }
        // 参加申込を削除
        await db.execute('DELETE FROM registrations WHERE email = ? AND event_id = ?', [email, eventId]);
        return (0, response_1.successResponse)({
            message: '参加申込を取消しました',
            email,
            event_id: parseInt(eventId, 10),
        });
    }
    catch (error) {
        console.error('Unregister from event error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
