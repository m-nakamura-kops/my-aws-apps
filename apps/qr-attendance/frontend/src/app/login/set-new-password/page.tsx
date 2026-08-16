'use client';

/**
 * Cognito 招待後の初回ログイン: NEW_PASSWORD_REQUIRED / CONFIRM_SIGN_IN 完了用
 */

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ErrorAlert from '@/components/ui/ErrorAlert';
import LoadingButton from '@/components/ui/LoadingButton';

function SetNewPasswordForm() {
  const searchParams = useSearchParams();
  const email = (searchParams.get('email') || '').trim();
  const router = useRouter();
  const { completeNewPassword, isAuthenticated, isLoading: authLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      router.replace('/home');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('メールアドレスが指定されていません。ログイン画面からやり直してください。');
      return;
    }
    if (password.length < 8) {
      setError('パスワードは8文字以上にしてください');
      return;
    }
    if (password !== confirm) {
      setError('確認用パスワードが一致しません');
      return;
    }
    setSubmitting(true);
    try {
      await completeNewPassword(email, password);
      router.replace('/home');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'パスワード設定に失敗しました';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">ホームへ移動しています...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            初回パスワード設定
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            招待メールの仮パスワードでログインした直後の方は、ここで新しいパスワードを設定してください。
          </p>
          {email && (
            <p className="mt-2 text-center text-sm text-gray-800 font-medium">{email}</p>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                新しいパスワード（8文字以上）
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
                確認用
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>
          <LoadingButton type="submit" loading={submitting} variant="primary" className="w-full">
            設定してログイン
          </LoadingButton>
          <div className="text-center">
            <Link href="/login" className="text-sm text-indigo-600 hover:text-indigo-500">
              ログイン画面に戻る
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SetNewPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
        </div>
      }
    >
      <SetNewPasswordForm />
    </Suspense>
  );
}
