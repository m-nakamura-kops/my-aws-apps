/**
 * バリデーション用の共通ロジック（メール・パスワード等）
 */
export declare const EMAIL_REGEX: RegExp;
export declare function validateEmail(email: string): boolean;
export declare function validatePassword(password: string): boolean;
export declare function validateRequiredStrings(fields: Record<string, string | null | undefined>): boolean;
//# sourceMappingURL=validation.d.ts.map