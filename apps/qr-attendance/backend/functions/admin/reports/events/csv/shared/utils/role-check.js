"use strict";
/**
 * 役割チェックユーティリティ
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRole = void 0;
exports.isAdmin = isAdmin;
exports.isStaffOrAdmin = isStaffOrAdmin;
exports.getRoleName = getRoleName;
var UserRole;
(function (UserRole) {
    UserRole[UserRole["USER"] = 1] = "USER";
    UserRole[UserRole["STAFF"] = 2] = "STAFF";
    UserRole[UserRole["ADMIN"] = 3] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
/**
 * ユーザーが管理者かどうかをチェック
 */
function isAdmin(roleFlag) {
    return roleFlag === UserRole.ADMIN;
}
/**
 * ユーザーがスタッフ以上かどうかをチェック
 */
function isStaffOrAdmin(roleFlag) {
    return roleFlag === UserRole.STAFF || roleFlag === UserRole.ADMIN;
}
/**
 * 役割名を取得
 */
function getRoleName(roleFlag) {
    if (roleFlag === UserRole.ADMIN)
        return '管理者';
    if (roleFlag === UserRole.STAFF)
        return 'スタッフ';
    return '利用者';
}
