import {
  successResponse,
  errorResponse,
  corsResponse,
  normalizeApiGatewayHeaders,
  safeJsonStringify,
} from '../response';

describe('response (API Gateway proxy safe)', () => {
  it('safeJsonStringify never returns undefined', () => {
    expect(safeJsonStringify(undefined)).toBe('null');
    expect(safeJsonStringify(null)).toBe('null');
    expect(safeJsonStringify({ a: 1 })).toBe('{"a":1}');
  });

  it('normalizeApiGatewayHeaders drops null/undefined and stringifies', () => {
    expect(
      normalizeApiGatewayHeaders({
        'Content-Type': 'application/json',
        'X-Missing': undefined,
        'X-Null': null,
        'X-Num': 42,
      })
    ).toEqual({
      'Content-Type': 'application/json',
      'X-Num': '42',
    });
  });

  it('successResponse has all-string headers and string body', () => {
    const r = successResponse({ ok: true });
    expect(typeof r.body).toBe('string');
    expect(r.headers['Content-Type']).toContain('application/json');
    expect(r.headers['Access-Control-Allow-Origin']).toMatch(/^http/);
    Object.values(r.headers).forEach((v) => {
      expect(typeof v).toBe('string');
      expect(v).not.toBe('undefined');
    });
  });

  it('errorResponse stringifies error fields', () => {
    const r = errorResponse('E', 'M', 400, { x: 1 });
    const body = JSON.parse(r.body);
    expect(body.error).toBe('E');
    expect(body.message).toBe('M');
  });

  it('corsResponse has no undefined header values', () => {
    const r = corsResponse();
    Object.values(r.headers).forEach((v) => {
      expect(typeof v).toBe('string');
    });
  });
});
