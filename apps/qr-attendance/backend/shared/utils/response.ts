/**
 * Lambda関数のレスポンスヘルパー
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

/**
 * 成功レスポンスを生成
 */
export function successResponse<T>(
  data: T,
  statusCode: number = 200
): ApiResponse<T> {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(data),
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
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify({
      error,
      message,
      details,
    }),
  };
}

/**
 * CORS用のOPTIONSレスポンス
 */
export function corsResponse(): ApiResponse {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: '',
  };
}
