"use strict";
/**
 * イベント作成Lambda関数
 * POST /v1/admin/events
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
        // リクエストボディの解析
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const { event_name, event_date, location, capacity, summary } = JSON.parse(event.body);
        // バリデーション
        if (!event_name || !event_date) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'event_name and event_date are required', 400);
        }
        // 日付のバリデーション
        const eventDate = new Date(event_date);
        if (isNaN(eventDate.getTime())) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid event_date format', 400);
        }
        // MySQL DATETIME形式に変換（ISO 8601 のままではエラーになるため）
        const eventDateForDb = eventDate.toISOString().slice(0, 19).replace('T', ' ');
        // データベース接続を取得（既に初期化済み）
        const db = (0, connection_1.getDB)();
        // イベント作成
        const [result] = await db.execute(`INSERT INTO events (event_name, event_date, location, capacity, summary)
       VALUES (?, ?, ?, ?, ?)`, [
            event_name,
            eventDateForDb,
            location || null,
            capacity || null,
            summary || null,
        ]);
        const eventId = result.insertId;
        // 作成されたイベントを取得
        const [events] = await db.execute('SELECT * FROM events WHERE event_id = ?', [eventId]);
        return (0, response_1.successResponse)({
            eventId: eventId,
            event: events[0],
        }, 201);
    }
    catch (error) {
        console.error('Create event error:', error);
        // データベースエラーの処理
        if (error.code === 'ER_DUP_ENTRY') {
            return (0, response_1.errorResponse)('CONFLICT', 'Event already exists', 409);
        }
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
