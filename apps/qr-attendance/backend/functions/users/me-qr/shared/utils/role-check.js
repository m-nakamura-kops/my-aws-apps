"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = isAdmin;
exports.isStaffOrAdmin = isStaffOrAdmin;
function isAdmin(roleFlag) {
    return roleFlag === 3;
}
function isStaffOrAdmin(roleFlag) {
    return roleFlag === 2 || roleFlag === 3;
}
