/**
 * Lambda関数のレスポンスヘルパー
 *
 * API Gateway (Lambda プロキシ統合) はレスポンスを厳密にマーシャルする。
 * - headers の値はすべて string（undefined / null / 非プリミティブは不可）
 * - body は必ず string（JSON.stringify(undefined) は undefined になりマーシャルエラーの原因になる）
 *
 * CORS: 既定は http://localhost:3000。本番は環境変数 CORS_ALLOW_ORIGIN。
 */

export interface ApiResponse<T = any> {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: any;
}

const DEFAULT_CORS_ALLOW_ORIGIN = 'http://localhost:3000';

const CORS_ALLOW_HEADERS =
  'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token';
const CORS_ALLOW_METHODS = 'GET,POST,PUT,DELETE,OPTIONS';

/**
 * Access-Control-Allow-Origin（常に非空 string）
 */
export function getCorsAllowOrigin(): string {
  const v = process.env.CORS_ALLOW_ORIGIN;
  if (v != null && String(v).trim() !== '') {
    return String(v).trim();
  }
  return DEFAULT_CORS_ALLOW_ORIGIN;
}

/**
 * API Gateway が受け付ける headers オブジェクトに正規化する。
 * - 値はすべて String()（undefined / null のキーは落とす）
 * - 空キーはスキップ
 */
export function normalizeApiGatewayHeaders(
  input: Record<string, string | number | boolean | undefined | null>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(input)) {
    if (key == null || String(key).trim() === '') continue;
    if (val === undefined || val === null) continue;
    const s = String(val);
    out[String(key)] = s;
  }
  return out;
}

/**
 * JSON ボディを必ず string にする（MarshalError / Runtime.MarshalError 防止）
 */
export function safeJsonStringify(value: unknown): string {
  try {
    const s = JSON.stringify(value, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    if (s === undefined) {
      return 'null';
    }
    return s;
  } catch {
    return JSON.stringify({
      error: 'SERIALIZATION_ERROR',
      message: 'Response payload could not be serialized',
    });
  }
}

/** CORS ヘッダーのみ（重複キーなし・正規化済み） */
export function corsHeaders(): Record<string, string> {
  return normalizeApiGatewayHeaders({
    'Access-Control-Allow-Origin': getCorsAllowOrigin(),
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
  });
}

/** JSON レスポンス用: Content-Type + CORS を1回だけ合成（Allow-Origin 二重付与防止） */
function jsonResponseHeaders(): Record<string, string> {
  return normalizeApiGatewayHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': getCorsAllowOrigin(),
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
  });
}

function normalizeStatusCode(code: number): number {
  const n = Number(code);
  if (!Number.isFinite(n)) return 200;
  const i = Math.trunc(n);
  if (i < 100 || i > 599) return 200;
  return i;
}

/**
 * 成功レスポンスを生成
 */
export function successResponse<T>(
  data: T,
  statusCode: number = 200
): ApiResponse<T> {
  return {
    statusCode: normalizeStatusCode(statusCode),
    headers: jsonResponseHeaders(),
    body: safeJsonStringify(data),
  };
}

/**
 * エラーレスポンスを生成
 */
export function errorResponse(
  error: string,
  message: string,
  statusCode: number = 400,
  details?: any
): ApiResponse<ApiError> {
  const payload: ApiError = {
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

/**
 * CORS用のOPTIONSレスポンス
 */
export function corsResponse(): ApiResponse {
  return {
    statusCode: 200,
    headers: corsHeaders(),
    body: '',
  };
}
