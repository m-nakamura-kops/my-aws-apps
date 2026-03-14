"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const response_1 = require("../response");
describe('response', () => {
    describe('successResponse', () => {
        it('returns 200 and JSON body by default', () => {
            const res = (0, response_1.successResponse)({ id: 1, name: 'test' });
            expect(res.statusCode).toBe(200);
            expect(res.headers['Content-Type']).toBe('application/json');
            expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
            expect(JSON.parse(res.body)).toEqual({ id: 1, name: 'test' });
        });
        it('accepts custom status code', () => {
            const res = (0, response_1.successResponse)({ created: true }, 201);
            expect(res.statusCode).toBe(201);
            expect(JSON.parse(res.body)).toEqual({ created: true });
        });
        it('includes CORS headers', () => {
            const res = (0, response_1.successResponse)({});
            expect(res.headers['Access-Control-Allow-Headers']).toBe('Content-Type,Authorization');
            expect(res.headers['Access-Control-Allow-Methods']).toBe('GET,POST,PUT,DELETE,OPTIONS');
        });
    });
    describe('errorResponse', () => {
        it('returns default 400 and error shape', () => {
            const res = (0, response_1.errorResponse)('ValidationError', 'Invalid input');
            expect(res.statusCode).toBe(400);
            const body = JSON.parse(res.body);
            expect(body.error).toBe('ValidationError');
            expect(body.message).toBe('Invalid input');
            expect(body.details).toBeUndefined();
        });
        it('accepts custom status code and details', () => {
            const res = (0, response_1.errorResponse)('NotFound', 'User not found', 404, { userId: 'x' });
            expect(res.statusCode).toBe(404);
            const body = JSON.parse(res.body);
            expect(body.error).toBe('NotFound');
            expect(body.message).toBe('User not found');
            expect(body.details).toEqual({ userId: 'x' });
        });
        it('includes CORS headers', () => {
            const res = (0, response_1.errorResponse)('E', 'M');
            expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
        });
    });
    describe('corsResponse', () => {
        it('returns 200 with empty body and CORS headers', () => {
            const res = (0, response_1.corsResponse)();
            expect(res.statusCode).toBe(200);
            expect(res.body).toBe('');
            expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
            expect(res.headers['Access-Control-Allow-Methods']).toBe('GET,POST,PUT,DELETE,OPTIONS');
        });
    });
});
//# sourceMappingURL=response.test.js.map