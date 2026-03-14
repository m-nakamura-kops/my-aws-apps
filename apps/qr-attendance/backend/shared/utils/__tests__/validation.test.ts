import {
  validateEmail,
  validatePassword,
  validateRequiredStrings,
  EMAIL_REGEX,
} from '../validation';

describe('validation', () => {
  describe('validateEmail', () => {
    it('valid email returns true', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('a@b.co')).toBe(true);
      expect(validateEmail('  user@example.com  ')).toBe(true);
    });

    it('invalid email returns false', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('user@.com')).toBe(false);
    });

    it('non-string returns false', () => {
      expect(validateEmail(null as any)).toBe(false);
      expect(validateEmail(undefined as any)).toBe(false);
      expect(validateEmail(123 as any)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('8文字以上で true', () => {
      expect(validatePassword('12345678')).toBe(true);
      expect(validatePassword('password')).toBe(true);
      expect(validatePassword('a'.repeat(16))).toBe(true);
    });

    it('8文字未満で false', () => {
      expect(validatePassword('')).toBe(false);
      expect(validatePassword('1234567')).toBe(false);
    });

    it('non-string returns false', () => {
      expect(validatePassword(null as any)).toBe(false);
      expect(validatePassword(undefined as any)).toBe(false);
    });
  });

  describe('validateRequiredStrings', () => {
    it('すべて値があれば true', () => {
      expect(validateRequiredStrings({ a: 'x', b: 'y' })).toBe(true);
      expect(validateRequiredStrings({ a: '  x  ' })).toBe(true);
    });

    it('空や null/undefined があれば false', () => {
      expect(validateRequiredStrings({ a: '', b: 'y' })).toBe(false);
      expect(validateRequiredStrings({ a: 'x', b: null })).toBe(false);
      expect(validateRequiredStrings({ a: 'x', b: undefined })).toBe(false);
      expect(validateRequiredStrings({ a: '   ' })).toBe(false);
    });
  });

  describe('EMAIL_REGEX', () => {
    it('matches valid emails', () => {
      expect(EMAIL_REGEX.test('a@b.c')).toBe(true);
      expect(EMAIL_REGEX.test('user@example.com')).toBe(true);
    });

    it('does not match invalid', () => {
      expect(EMAIL_REGEX.test('user')).toBe(false);
      expect(EMAIL_REGEX.test('user@')).toBe(false);
    });
  });
});
