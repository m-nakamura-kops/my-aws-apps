"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const response_1 = require("../response");
describe('response (API Gateway proxy safe)', () => {
    it('safeJsonStringify never returns undefined', () => {
        expect((0, response_1.safeJsonStringify)(undefined)).toBe('null');
        expect((0, response_1.safeJsonStringify)(null)).toBe('null');
        expect((0, response_1.safeJsonStringify)({ a: 1 })).toBe('{"a":1}');
    });
    it('normalizeApiGatewayHeaders drops null/undefined and stringifies', () => {
        expect((0, response_1.normalizeApiGatewayHeaders)({
            'Content-Type': 'application/json',
            'X-Missing': undefined,
            'X-Null': null,
            'X-Num': 42,
        })).toEqual({
            'Content-Type': 'application/json',
            'X-Num': '42',
        });
    });
    it('successResponse has all-string headers and string body', () => {
        const r = (0, response_1.successResponse)({ ok: true });
        expect(typeof r.body).toBe('string');
        expect(r.headers['Content-Type']).toContain('application/json');
        expect(r.headers['Access-Control-Allow-Origin']).toMatch(/^http/);
        Object.values(r.headers).forEach((v) => {
            expect(typeof v).toBe('string');
            expect(v).not.toBe('undefined');
        });
    });
    it('errorResponse stringifies error fields', () => {
        const r = (0, response_1.errorResponse)('E', 'M', 400, { x: 1 });
        const body = JSON.parse(r.body);
        expect(body.error).toBe('E');
        expect(body.message).toBe('M');
    });
    it('corsResponse has no undefined header values', () => {
        const r = (0, response_1.corsResponse)();
        Object.values(r.headers).forEach((v) => {
            expect(typeof v).toBe('string');
        });
    });
});
