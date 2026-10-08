"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStaffOrAdmin = isStaffOrAdmin;
function isStaffOrAdmin(roleFlag) {
    const n = Number(roleFlag);
    return n === 2 || n === 3;
}
