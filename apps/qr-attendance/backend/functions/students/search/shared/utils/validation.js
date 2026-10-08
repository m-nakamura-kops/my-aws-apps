"use strict";
/**
 * バリデーション用の共通ロジック（メール・パスワード等）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMAIL_REGEX = void 0;
exports.validateEmail = validateEmail;
exports.validatePassword = validatePassword;
exports.validateRequiredStrings = validateRequiredStrings;
exports.EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validateEmail(email) {
    return typeof email === 'string' && exports.EMAIL_REGEX.test(email.trim());
}
const MIN_PASSWORD_LENGTH = 8;
function validatePassword(password) {
    return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}
function validateRequiredStrings(fields) {
    return Object.values(fields).every((v) => v != null && String(v).trim() !== '');
}
//# sourceMappingURL=validation.js.map