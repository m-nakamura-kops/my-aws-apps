/**
 * 役割チェックユーティリティ
 */
export declare enum UserRole {
    USER = 1,// 利用者
    STAFF = 2,// スタッフ等
    ADMIN = 3
}
/**
 * ユーザーが管理者かどうかをチェック
 */
export declare function isAdmin(roleFlag: number | null | undefined): boolean;
/**
 * ユーザーがスタッフ以上かどうかをチェック
 */
export declare function isStaffOrAdmin(roleFlag: number | null | undefined): boolean;
/**
 * 役割名を取得
 */
export declare function getRoleName(roleFlag: number | null | undefined): string;
//# sourceMappingURL=role-check.d.ts.map