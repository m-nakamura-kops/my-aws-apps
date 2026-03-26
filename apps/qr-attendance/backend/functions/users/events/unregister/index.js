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
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        const eventId = event.pathParameters?.eventId;
        if (!eventId) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'eventId is required', 400);
        }
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
        await (0, secrets_1.initDBFromSecrets)();
        const pool = (0, connection_1.getDB)();
        const outcome = await (0, connection_1.withConnection)(pool, async (conn) => {
            const [events] = (await conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId]));
            if (events.length === 0) {
                return { kind: 'no_event' };
            }
            const [registrations] = (await conn.execute('SELECT * FROM registrations WHERE email = ? AND event_id = ?', [email, eventId]));
            if (registrations.length === 0) {
                return { kind: 'no_reg' };
            }
            await conn.execute('DELETE FROM registrations WHERE email = ? AND event_id = ?', [email, eventId]);
            return { kind: 'ok' };
        });
        if (outcome.kind === 'no_event') {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
        }
        if (outcome.kind === 'no_reg') {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Registration not found', 404);
        }
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
