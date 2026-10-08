/**
 * ログイン時 Cognito が初回パスワード変更を要求している場合に AuthContext が投げる。
 */
export class NewPasswordRequiredError extends Error {
  readonly email: string;

  constructor(email: string) {
    super('NEW_PASSWORD_REQUIRED');
    this.name = 'NewPasswordRequiredError';
    this.email = email;
  }
}

export function isNewPasswordRequiredError(e: unknown): e is NewPasswordRequiredError {
  return e instanceof NewPasswordRequiredError;
}
