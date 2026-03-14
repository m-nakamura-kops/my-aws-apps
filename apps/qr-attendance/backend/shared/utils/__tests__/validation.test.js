"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validation_1 = require("../validation");
describe('validation', () => {
    describe('validateEmail', () => {
        it('valid email returns true', () => {
            expect((0, validation_1.validateEmail)('user@example.com')).toBe(true);
            expect((0, validation_1.validateEmail)('a@b.co')).toBe(true);
            expect((0, validation_1.validateEmail)('  user@example.com  ')).toBe(true);
        });
        it('invalid email returns false', () => {
            expect((0, validation_1.validateEmail)('')).toBe(false);
            expect((0, validation_1.validateEmail)('invalid')).toBe(false);
            expect((0, validation_1.validateEmail)('@example.com')).toBe(false);
            expect((0, validation_1.validateEmail)('user@')).toBe(false);
            expect((0, validation_1.validateEmail)('user@.com')).toBe(false);
        });
        it('non-string returns false', () => {
            expect((0, validation_1.validateEmail)(null)).toBe(false);
            expect((0, validation_1.validateEmail)(undefined)).toBe(false);
            expect((0, validation_1.validateEmail)(123)).toBe(false);
        });
    });
    describe('validatePassword', () => {
        it('8文字以上で true', () => {
            expect((0, validation_1.validatePassword)('12345678')).toBe(true);
            expect((0, validation_1.validatePassword)('password')).toBe(true);
            expect((0, validation_1.validatePassword)('a'.repeat(16))).toBe(true);
        });
        it('8文字未満で false', () => {
            expect((0, validation_1.validatePassword)('')).toBe(false);
            expect((0, validation_1.validatePassword)('1234567')).toBe(false);
        });
        it('non-string returns false', () => {
            expect((0, validation_1.validatePassword)(null)).toBe(false);
            expect((0, validation_1.validatePassword)(undefined)).toBe(false);
        });
    });
    describe('validateRequiredStrings', () => {
        it('すべて値があれば true', () => {
            expect((0, validation_1.validateRequiredStrings)({ a: 'x', b: 'y' })).toBe(true);
            expect((0, validation_1.validateRequiredStrings)({ a: '  x  ' })).toBe(true);
        });
        it('空や null/undefined があれば false', () => {
            expect((0, validation_1.validateRequiredStrings)({ a: '', b: 'y' })).toBe(false);
            expect((0, validation_1.validateRequiredStrings)({ a: 'x', b: null })).toBe(false);
            expect((0, validation_1.validateRequiredStrings)({ a: 'x', b: undefined })).toBe(false);
            expect((0, validation_1.validateRequiredStrings)({ a: '   ' })).toBe(false);
        });
    });
    describe('EMAIL_REGEX', () => {
        it('matches valid emails', () => {
            expect(validation_1.EMAIL_REGEX.test('a@b.c')).toBe(true);
            expect(validation_1.EMAIL_REGEX.test('user@example.com')).toBe(true);
        });
        it('does not match invalid', () => {
            expect(validation_1.EMAIL_REGEX.test('user')).toBe(false);
            expect(validation_1.EMAIL_REGEX.test('user@')).toBe(false);
        });
    });
});
//# sourceMappingURL=validation.test.js.map