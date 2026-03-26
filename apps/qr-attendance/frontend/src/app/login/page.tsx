'use client';

/**
 * ログイン画面（WBS 2-2 ログイン・認証画面 雛形）
 *
 * - 認証済みでアクセスした場合は /home へリダイレクト。
 * - メール・パスワードで API ログイン → 成功時は /home へ。
 * @see apps/qr-attendance/docs/FE_2-2_LOGIN_AUTH_IMPLEMENTATION_PLAN.md
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { isNewPasswordRequiredError } from '@/lib/auth-errors';
import ErrorAlert from '@/components/ui/ErrorAlert';
import LoadingButton from '@/components/ui/LoadingButton';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // 認証済みなら /home へ（実装案 5.4）
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      router.replace('/home');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimEmail = email.trim();
    const trimPassword = password.trim();
    if (!trimEmail || !trimPassword) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    setIsLoading(true);
    try {
      await login(trimEmail, trimPassword);
      router.replace('/home');
    } catch (err: unknown) {
      if (isNewPasswordRequiredError(err)) {
        router.replace(`/login/set-new-password?email=${encodeURIComponent(err.email)}`);
        return;
      }
      const message = err instanceof Error ? err.message : 'ログインに失敗しました';
      setError(message);
    } finally {
      setIsLoading(false);
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
            QRコード打刻システム
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            ログイン
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <ErrorAlert
              message={error}
              onDismiss={() => setError('')}
            />
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="パスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <LoadingButton
              type="submit"
              loading={isLoading}
              variant="primary"
              className="w-full"
            >
              ログイン
            </LoadingButton>
          </div>

          <div className="text-center">
            <Link
              href="/register"
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              新規登録はこちら
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
