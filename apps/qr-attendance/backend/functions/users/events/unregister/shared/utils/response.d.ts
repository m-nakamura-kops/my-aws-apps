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
export declare function successResponse<T>(data: T, statusCode?: number): ApiResponse<T>;
/**
 * エラーレスポンスを生成
 */
export declare function errorResponse(error: string, message: string, statusCode?: number, details?: any): ApiResponse<ApiError>;
/**
 * CORS用のOPTIONSレスポンス
 */
export declare function corsResponse(): ApiResponse;
//# sourceMappingURL=response.d.ts.map