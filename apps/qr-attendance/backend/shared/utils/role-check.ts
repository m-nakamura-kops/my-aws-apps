/**
 * 役割チェックユーティリティ
 */

export enum UserRole {
  USER = 1,      // 利用者
  STAFF = 2,     // スタッフ等
  ADMIN = 3,     // 管理者
}

/**
 * ユーザーが管理者かどうかをチェック
 */
export function isAdmin(roleFlag: number | null | undefined): boolean {
  return roleFlag === UserRole.ADMIN;
}

/**
 * ユーザーがスタッフ以上かどうかをチェック
 */
export function isStaffOrAdmin(roleFlag: number | null | undefined): boolean {
  return roleFlag === UserRole.STAFF || roleFlag === UserRole.ADMIN;
}

/**
 * 役割名を取得
 */
export function getRoleName(roleFlag: number | null | undefined): string {
  if (roleFlag === UserRole.ADMIN) return '管理者';
  if (roleFlag === UserRole.STAFF) return 'スタッフ';
  return '利用者';
}
