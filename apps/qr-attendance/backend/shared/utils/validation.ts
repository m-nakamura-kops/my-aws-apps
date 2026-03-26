/**
 * バリデーション用の共通ロジック（メール・パスワード等）
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): boolean {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

export function validateRequiredStrings(fields: Record<string, string | null | undefined>): boolean {
  return Object.values(fields).every(
    (v) => v != null && String(v).trim() !== ''
  );
}
