/**
 * 認証・権限チェックユーティリティ
 */
import { APIGatewayProxyEvent } from 'aws-lambda';
/** 権限チェック結果（成功） */
export interface PermissionOk {
    authorized: true;
    email: string;
    roleFlag: number;
}
/** 権限チェック結果（失敗） */
export interface PermissionDenied {
    authorized: false;
    email: string | null;
    error: string;
    statusCode: 401 | 403;
}
export type StaffOrAdminPermissionResult = PermissionOk | PermissionDenied;
/**
 * リクエストからユーザーemailを取得
 * 優先順位: Authorizationヘッダー（JWT または ローカル用 base64 JSON） > クエリパラメータ > リクエストボディ
 */
export declare function getUserEmailFromRequest(event: APIGatewayProxyEvent): string | null;
/**
 * ユーザーのrole_flagを取得
 */
export declare function getUserRoleFlag(email: string): Promise<number | null>;
/**
 * 管理者権限チェック
 */
export declare function checkAdminPermission(event: APIGatewayProxyEvent): Promise<{
    authorized: boolean;
    email: string | null;
    error?: string;
}>;
/**
 * スタッフまたは管理者権限チェック
 * 他エンドポイントで使い回すための共通関数。認証なし→401、権限不足→403。
 */
export declare function checkStaffOrAdminPermission(event: APIGatewayProxyEvent): Promise<StaffOrAdminPermissionResult>;
//# sourceMappingURL=auth.d.ts.map