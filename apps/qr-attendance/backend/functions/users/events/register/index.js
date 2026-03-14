"use strict";
/**
 * イベント参加申込Lambda関数
 * POST /v1/users/events/{eventId}/register
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
        // リクエストボディからemailを取得
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const { email } = JSON.parse(event.body);
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
        const eventData = events[0];
        // 定員チェック
        if (eventData.capacity !== null) {
            const [currentRegistrations] = await db.execute('SELECT COUNT(*) as count FROM registrations WHERE event_id = ?', [eventId]);
            const currentCount = currentRegistrations[0]?.count || 0;
            if (currentCount >= eventData.capacity) {
                return (0, response_1.errorResponse)('BAD_REQUEST', 'Event is full', 400);
            }
        }
        // ユーザーの存在確認
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'User not found', 404);
        }
        // 既存の申込を確認（重複チェック）
        const [existingRegistrations] = await db.execute('SELECT * FROM registrations WHERE email = ? AND event_id = ?', [email, eventId]);
        if (existingRegistrations.length > 0) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Already registered for this event', 400);
        }
        // 参加申込を登録
        const [result] = await db.execute('INSERT INTO registrations (email, event_id) VALUES (?, ?)', [email, eventId]);
        return (0, response_1.successResponse)({
            reg_id: result.insertId,
            email,
            event_id: parseInt(eventId, 10),
            message: '参加申込が完了しました',
        });
    }
    catch (error) {
        console.error('Register for event error:', error);
        // 重複エラーの場合
        if (error.code === 'ER_DUP_ENTRY') {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Already registered for this event', 400);
        }
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
