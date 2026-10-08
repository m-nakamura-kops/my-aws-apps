"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStaffOrAdmin = isStaffOrAdmin;
function isStaffOrAdmin(roleFlag) {
    return roleFlag === 2 || roleFlag === 3;
}
