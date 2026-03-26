"use strict";
/**
 * Lambda関数のレスポンスヘルパー
 * API Gateway プロキシ: headers はすべて string、body は必ず string。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCorsAllowOrigin = getCorsAllowOrigin;
exports.normalizeApiGatewayHeaders = normalizeApiGatewayHeaders;
exports.safeJsonStringify = safeJsonStringify;
exports.corsHeaders = corsHeaders;
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
exports.corsResponse = corsResponse;
const DEFAULT_CORS_ALLOW_ORIGIN = 'http://localhost:3000';
const CORS_ALLOW_HEADERS = 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token';
const CORS_ALLOW_METHODS = 'GET,POST,PUT,DELETE,OPTIONS';
function getCorsAllowOrigin() {
    const v = process.env.CORS_ALLOW_ORIGIN;
    if (v != null && String(v).trim() !== '') {
        return String(v).trim();
    }
    return DEFAULT_CORS_ALLOW_ORIGIN;
}
function normalizeApiGatewayHeaders(input) {
    const out = {};
    for (const [key, val] of Object.entries(input)) {
        if (key == null || String(key).trim() === '')
            continue;
        if (val === undefined || val === null)
            continue;
        out[String(key)] = String(val);
    }
    return out;
}
function safeJsonStringify(value) {
    try {
        const s = JSON.stringify(value, (_k, v) => typeof v === 'bigint' ? v.toString() : v);
        if (s === undefined) {
            return 'null';
        }
        return s;
    }
    catch {
        return JSON.stringify({
            error: 'SERIALIZATION_ERROR',
            message: 'Response payload could not be serialized',
        });
    }
}
function corsHeaders() {
    return normalizeApiGatewayHeaders({
        'Access-Control-Allow-Origin': getCorsAllowOrigin(),
        'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
        'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
    });
}
function jsonResponseHeaders() {
    return normalizeApiGatewayHeaders({
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': getCorsAllowOrigin(),
        'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
        'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
    });
}
function normalizeStatusCode(code) {
    const n = Number(code);
    if (!Number.isFinite(n))
        return 200;
    const i = Math.trunc(n);
    if (i < 100 || i > 599)
        return 200;
    return i;
}
function successResponse(data, statusCode = 200) {
    return {
        statusCode: normalizeStatusCode(statusCode),
        headers: jsonResponseHeaders(),
        body: safeJsonStringify(data),
    };
}
function errorResponse(error, message, statusCode = 400, details) {
    const payload = {
        error: String(error ?? 'ERROR'),
        message: String(message ?? ''),
    };
    if (details !== undefined) {
        payload.details = details;
    }
    return {
        statusCode: normalizeStatusCode(statusCode),
        headers: jsonResponseHeaders(),
        body: safeJsonStringify(payload),
    };
}
function corsResponse() {
    return {
        statusCode: 200,
        headers: corsHeaders(),
        body: '',
    };
}
