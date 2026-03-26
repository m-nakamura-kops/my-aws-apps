"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../auth");
const mockExecute = jest.fn();
jest.mock('../../db/connection', () => ({
    getDB: jest.fn(() => ({ execute: mockExecute })),
}));
function b64(obj) {
    return Buffer.from(JSON.stringify(obj)).toString('base64');
}
function createEvent(overrides = {}) {
    return {
        headers: {},
        body: null,
        queryStringParameters: null,
        ...overrides,
    };
}
describe('auth', () => {
    beforeEach(() => {
        mockExecute.mockReset();
    });
    describe('getUserEmailFromRequest', () => {
        it('returns email from Bearer JWT (second segment payload)', () => {
            const token = `header.${b64({ email: 'jwt@example.com', sub: 'x' })}.sig`;
            const event = createEvent({ headers: { Authorization: `Bearer ${token}` } });
            expect((0, auth_1.getUserEmailFromRequest)(event)).toBe('jwt@example.com');
        });
        it('returns email from Bearer base64 JSON (local dev style)', () => {
            const token = Buffer.from(JSON.stringify({ email: 'local@example.com' })).toString('base64');
            const event = createEvent({ headers: { authorization: `Bearer ${token}` } });
            expect((0, auth_1.getUserEmailFromRequest)(event)).toBe('local@example.com');
        });
        it('returns email from queryStringParameters', () => {
            const event = createEvent({ queryStringParameters: { email: 'query@example.com' } });
            expect((0, auth_1.getUserEmailFromRequest)(event)).toBe('query@example.com');
        });
        it('returns email from body', () => {
            const event = createEvent({ body: JSON.stringify({ email: 'body@example.com' }) });
            expect((0, auth_1.getUserEmailFromRequest)(event)).toBe('body@example.com');
        });
        it('prefers Authorization over query and body', () => {
            const token = `h.${b64({ email: 'auth@example.com' })}.s`;
            const event = createEvent({
                headers: { Authorization: `Bearer ${token}` },
                queryStringParameters: { email: 'query@example.com' },
                body: JSON.stringify({ email: 'body@example.com' }),
            });
            expect((0, auth_1.getUserEmailFromRequest)(event)).toBe('auth@example.com');
        });
        it('returns null when no Bearer token and no query/body', () => {
            expect((0, auth_1.getUserEmailFromRequest)(createEvent())).toBeNull();
            expect((0, auth_1.getUserEmailFromRequest)(createEvent({ headers: { Authorization: 'Basic x' } }))).toBeNull();
        });
        it('returns null when JWT payload has no email', () => {
            const token = `h.${b64({ sub: 'only' })}.s`;
            const event = createEvent({ headers: { Authorization: `Bearer ${token}` } });
            expect((0, auth_1.getUserEmailFromRequest)(event)).toBeNull();
        });
        it('falls back to query when Bearer token parse fails', () => {
            const event = createEvent({
                headers: { Authorization: 'Bearer not-valid-base64!!!' },
                queryStringParameters: { email: 'query@example.com' },
            });
            expect((0, auth_1.getUserEmailFromRequest)(event)).toBe('query@example.com');
        });
        it('returns null when body is invalid JSON', () => {
            const event = createEvent({ body: 'not json' });
            expect((0, auth_1.getUserEmailFromRequest)(event)).toBeNull();
        });
    });
    describe('getUserRoleFlag', () => {
        it('returns role_flag when user exists', async () => {
            mockExecute.mockResolvedValue([[{ role_flag: 3 }]]);
            const result = await (0, auth_1.getUserRoleFlag)('admin@example.com');
            expect(result).toBe(3);
            expect(mockExecute).toHaveBeenCalledWith('SELECT role_flag FROM users WHERE email = ?', ['admin@example.com']);
        });
        it('returns null when user not found', async () => {
            mockExecute.mockResolvedValue([[]]);
            const result = await (0, auth_1.getUserRoleFlag)('nobody@example.com');
            expect(result).toBeNull();
        });
        it('returns null when role_flag is missing', async () => {
            mockExecute.mockResolvedValue([[{}]]);
            const result = await (0, auth_1.getUserRoleFlag)('user@example.com');
            expect(result).toBeNull();
        });
    });
    describe('checkAdminPermission', () => {
        it('returns authorized when email in request and user is admin', async () => {
            mockExecute.mockResolvedValue([[{ role_flag: 3 }]]);
            const event = createEvent({ queryStringParameters: { email: 'admin@example.com' } });
            const result = await (0, auth_1.checkAdminPermission)(event);
            expect(result).toEqual({ authorized: true, email: 'admin@example.com' });
        });
        it('returns error when email missing', async () => {
            const event = createEvent();
            const result = await (0, auth_1.checkAdminPermission)(event);
            expect(result.authorized).toBe(false);
            expect(result.email).toBeNull();
            expect(result.error).toContain('User email is required');
        });
        it('returns error when user is not admin', async () => {
            mockExecute.mockResolvedValue([[{ role_flag: 1 }]]);
            const event = createEvent({ queryStringParameters: { email: 'user@example.com' } });
            const result = await (0, auth_1.checkAdminPermission)(event);
            expect(result.authorized).toBe(false);
            expect(result.email).toBe('user@example.com');
            expect(result.error).toContain('Admin access required');
        });
    });
});
