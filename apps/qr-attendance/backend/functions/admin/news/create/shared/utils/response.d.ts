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
export declare function getCorsAllowOrigin(): string;
export declare function normalizeApiGatewayHeaders(input: Record<string, string | number | boolean | undefined | null>): Record<string, string>;
export declare function safeJsonStringify(value: unknown): string;
export declare function corsHeaders(): Record<string, string>;
export declare function successResponse<T>(data: T, statusCode?: number): ApiResponse<T>;
export declare function errorResponse(error: string, message: string, statusCode?: number, details?: any): ApiResponse<ApiError>;
export declare function corsResponse(): ApiResponse;
//# sourceMappingURL=response.d.ts.map
