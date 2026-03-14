"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const role_check_1 = require("../role-check");
describe('role-check', () => {
    describe('isAdmin', () => {
        it('role_flag 3 returns true', () => {
            expect((0, role_check_1.isAdmin)(role_check_1.UserRole.ADMIN)).toBe(true);
            expect((0, role_check_1.isAdmin)(3)).toBe(true);
        });
        it('other values return false', () => {
            expect((0, role_check_1.isAdmin)(role_check_1.UserRole.USER)).toBe(false);
            expect((0, role_check_1.isAdmin)(role_check_1.UserRole.STAFF)).toBe(false);
            expect((0, role_check_1.isAdmin)(null)).toBe(false);
            expect((0, role_check_1.isAdmin)(undefined)).toBe(false);
        });
    });
    describe('isStaffOrAdmin', () => {
        it('2 or 3 returns true', () => {
            expect((0, role_check_1.isStaffOrAdmin)(role_check_1.UserRole.STAFF)).toBe(true);
            expect((0, role_check_1.isStaffOrAdmin)(role_check_1.UserRole.ADMIN)).toBe(true);
            expect((0, role_check_1.isStaffOrAdmin)(2)).toBe(true);
            expect((0, role_check_1.isStaffOrAdmin)(3)).toBe(true);
        });
        it('1 or null/undefined returns false', () => {
            expect((0, role_check_1.isStaffOrAdmin)(role_check_1.UserRole.USER)).toBe(false);
            expect((0, role_check_1.isStaffOrAdmin)(1)).toBe(false);
            expect((0, role_check_1.isStaffOrAdmin)(null)).toBe(false);
            expect((0, role_check_1.isStaffOrAdmin)(undefined)).toBe(false);
        });
    });
    describe('getRoleName', () => {
        it('returns Japanese label', () => {
            expect((0, role_check_1.getRoleName)(role_check_1.UserRole.ADMIN)).toBe('管理者');
            expect((0, role_check_1.getRoleName)(role_check_1.UserRole.STAFF)).toBe('スタッフ');
            expect((0, role_check_1.getRoleName)(role_check_1.UserRole.USER)).toBe('利用者');
            expect((0, role_check_1.getRoleName)(1)).toBe('利用者');
            expect((0, role_check_1.getRoleName)(2)).toBe('スタッフ');
            expect((0, role_check_1.getRoleName)(3)).toBe('管理者');
        });
        it('null/undefined returns 利用者', () => {
            expect((0, role_check_1.getRoleName)(null)).toBe('利用者');
            expect((0, role_check_1.getRoleName)(undefined)).toBe('利用者');
        });
    });
});
//# sourceMappingURL=role-check.test.js.map