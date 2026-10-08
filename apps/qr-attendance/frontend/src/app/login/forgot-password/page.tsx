'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { confirmResetPassword, resetPassword } from 'aws-amplify/auth';
import '@/lib/amplify-config';
import ErrorAlert from '@/components/ui/ErrorAlert';
import LoadingButton from '@/components/ui/LoadingButton';

type Step = 'request' | 'confirm' | 'complete';

function authErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  switch (error.name) {
    case 'CodeMismatchException':
      return '確認コードが正しくありません。メールをご確認ください。';
    case 'ExpiredCodeException':
      return '確認コードの有効期限が切れています。コードを再送してください。';
    case 'InvalidPasswordException':
      return 'パスワードは8文字以上で、英大文字・英小文字・数字をそれぞれ含めてください。';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return '試行回数が上限に達しました。しばらく待ってから再度お試しください。';
    case 'UserNotConfirmedException':
      return 'メールアドレスの確認が完了していません。管理者へお問い合わせください。';
    default:
      return error.message || fallback;
  }
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState((searchParams.get('email') || '').trim());
  const [confirmationCode, setConfirmationCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('メールアドレスを入力してください。');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({ username: normalizedEmail });
      setEmail(normalizedEmail);
      setStep('confirm');
      setMessage('登録済みのメールアドレスへ確認コードを送信しました。');
    } catch (err: unknown) {
      // アカウントの存在有無を第三者へ知らせない。
      if (err instanceof Error && err.name === 'UserNotFoundException') {
        setEmail(normalizedEmail);
        setStep('confirm');
        setMessage('登録済みの場合、メールアドレスへ確認コードを送信しました。');
      } else {
        setError(authErrorMessage(err, '確認コードの送信に失敗しました。'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!confirmationCode.trim()) {
      setError('確認コードを入力してください。');
      return;
    }
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError('パスワードは8文字以上で、英大文字・英小文字・数字をそれぞれ含めてください。');
      return;
    }
    if (password !== passwordConfirm) {
      setError('確認用パスワードが一致しません。');
      return;
    }

    setSubmitting(true);
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: confirmationCode.trim(),
        newPassword: password,
      });
      setStep('complete');
      setPassword('');
      setPasswordConfirm('');
      setConfirmationCode('');
    } catch (err: unknown) {
      setError(authErrorMessage(err, 'パスワードの更新に失敗しました。'));
    } finally {
      setSubmitting(false);
    }
  };

  const resendCode = async () => {
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      await resetPassword({ username: email });
      setMessage('確認コードを再送しました。');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'UserNotFoundException') {
        setMessage('登録済みの場合、確認コードを再送しました。');
      } else {
        setError(authErrorMessage(err, '確認コードの再送に失敗しました。'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'complete') {
    return (
      <div className="max-w-md w-full space-y-8 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">パスワードを更新しました</h1>
        <p className="text-sm text-gray-600">新しいパスワードでログインできます。</p>
        <Link
          href={`/login?email=${encodeURIComponent(email)}`}
          className="inline-block px-4 py-2 rounded-md font-medium bg-indigo-600 text-white hover:bg-indigo-700"
        >
          ログイン画面へ
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full space-y-8">
      <div>
        <h1 className="text-center text-3xl font-extrabold text-gray-900">パスワードの再設定</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          {step === 'request'
            ? '登録済みのメールアドレスを入力してください。'
            : 'メールで届いた確認コードと新しいパスワードを入力してください。'}
        </p>
      </div>

      <form className="space-y-6" onSubmit={step === 'request' ? sendCode : updatePassword}>
        {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}
        {message && (
          <div role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {message}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            disabled={step === 'confirm'}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          />
        </div>

        {step === 'confirm' && (
          <>
            <div>
              <label htmlFor="confirmation-code" className="block text-sm font-medium text-gray-700 mb-1">
                確認コード
              </label>
              <input
                id="confirmation-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={confirmationCode}
                onChange={(event) => setConfirmationCode(event.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                新しいパスワード
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">8文字以上・英大文字・英小文字・数字を含めてください。</p>
            </div>
            <div>
              <label htmlFor="password-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                新しいパスワード（確認）
              </label>
              <input
                id="password-confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
            </div>
          </>
        )}

        <LoadingButton type="submit" loading={submitting} variant="primary" className="w-full">
          {step === 'request' ? '確認コードを送信' : 'パスワードを更新'}
        </LoadingButton>

        {step === 'confirm' && (
          <div className="flex justify-center gap-4 text-sm">
            <button type="button" onClick={resendCode} disabled={submitting} className="text-indigo-600 hover:text-indigo-500 disabled:opacity-50">
              コードを再送
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('request');
                setMessage('');
                setError('');
              }}
              disabled={submitting}
              className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              メールアドレスを変更
            </button>
          </div>
        )}

        <div className="text-center">
          <Link href="/login" className="text-sm text-indigo-600 hover:text-indigo-500">
            ログイン画面に戻る
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Suspense
        fallback={<div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />}
      >
        <ForgotPasswordForm />
      </Suspense>
    </main>
  );
}
