import { isAdmin, isStaffOrAdmin, getRoleName, UserRole } from '../role-check';

describe('role-check', () => {
  describe('isAdmin', () => {
    it('role_flag 3 returns true', () => {
      expect(isAdmin(UserRole.ADMIN)).toBe(true);
      expect(isAdmin(3)).toBe(true);
    });

    it('other values return false', () => {
      expect(isAdmin(UserRole.USER)).toBe(false);
      expect(isAdmin(UserRole.STAFF)).toBe(false);
      expect(isAdmin(null)).toBe(false);
      expect(isAdmin(undefined)).toBe(false);
    });
  });

  describe('isStaffOrAdmin', () => {
    it('2 or 3 returns true', () => {
      expect(isStaffOrAdmin(UserRole.STAFF)).toBe(true);
      expect(isStaffOrAdmin(UserRole.ADMIN)).toBe(true);
      expect(isStaffOrAdmin(2)).toBe(true);
      expect(isStaffOrAdmin(3)).toBe(true);
    });

    it('1 or null/undefined returns false', () => {
      expect(isStaffOrAdmin(UserRole.USER)).toBe(false);
      expect(isStaffOrAdmin(1)).toBe(false);
      expect(isStaffOrAdmin(null)).toBe(false);
      expect(isStaffOrAdmin(undefined)).toBe(false);
    });
  });

  describe('getRoleName', () => {
    it('returns Japanese label', () => {
      expect(getRoleName(UserRole.ADMIN)).toBe('管理者');
      expect(getRoleName(UserRole.STAFF)).toBe('スタッフ');
      expect(getRoleName(UserRole.USER)).toBe('利用者');
      expect(getRoleName(1)).toBe('利用者');
      expect(getRoleName(2)).toBe('スタッフ');
      expect(getRoleName(3)).toBe('管理者');
    });

    it('null/undefined returns 利用者', () => {
      expect(getRoleName(null)).toBe('利用者');
      expect(getRoleName(undefined)).toBe('利用者');
    });
  });
});
