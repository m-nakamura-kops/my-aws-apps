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
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        const eventId = event.pathParameters?.eventId;
        if (!eventId) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'eventId is required', 400);
        }
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const { email } = JSON.parse(event.body);
        if (!email) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'email is required', 400);
        }
        await (0, secrets_1.initDBFromSecrets)();
        const pool = (0, connection_1.getDB)();
        const outcome = await (0, connection_1.withConnection)(pool, async (conn) => {
            const [events] = (await conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId]));
            if (events.length === 0) {
                return { kind: 'not_found_event' };
            }
            const eventData = events[0];
            if (eventData.capacity !== null) {
                const [currentRegistrations] = (await conn.execute('SELECT COUNT(*) as count FROM registrations WHERE event_id = ?', [eventId]));
                const currentCount = currentRegistrations[0]?.count || 0;
                if (currentCount >= eventData.capacity) {
                    return { kind: 'full' };
                }
            }
            const [users] = (await conn.execute('SELECT email, COALESCE(is_active, 1) AS is_active FROM users WHERE email = ?', [email]));
            if (users.length === 0) {
                return { kind: 'not_found_user' };
            }
            if (users[0].is_active === 0) {
                return { kind: 'inactive' };
            }
            const [existingRegistrations] = (await conn.execute('SELECT * FROM registrations WHERE email = ? AND event_id = ?', [email, eventId]));
            if (existingRegistrations.length > 0) {
                return { kind: 'already' };
            }
            const [result] = (await conn.execute('INSERT INTO registrations (email, event_id) VALUES (?, ?)', [email, eventId]));
            return { kind: 'ok', insertId: result.insertId };
        });
        if (outcome.kind === 'not_found_event') {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
        }
        if (outcome.kind === 'full') {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Event is full', 400);
        }
        if (outcome.kind === 'not_found_user') {
            return (0, response_1.errorResponse)('NOT_FOUND', 'User not found', 404);
        }
        if (outcome.kind === 'inactive') {
            return (0, response_1.errorResponse)('FORBIDDEN', '退会済みのため新規申込はできません', 403);
        }
        if (outcome.kind === 'already') {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Already registered for this event', 400);
        }
        return (0, response_1.successResponse)({
            reg_id: outcome.insertId,
            email,
            event_id: parseInt(eventId, 10),
            message: '参加申込が完了しました',
        });
    }
    catch (error) {
        console.error('Register for event error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Already registered for this event', 400);
        }
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
