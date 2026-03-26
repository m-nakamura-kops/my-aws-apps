'use client';

/**
 * No.6.4.1 利用者：マイページ (/user/me)
 * 自分のプロフィール・役割表示。GET /v1/users/me で取得。
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import SuccessAlert from '@/components/ui/SuccessAlert';
import LoadingButton from '@/components/ui/LoadingButton';
import { apiClient } from '@/lib/api-client';

const roleLabels: Record<number, string> = {
  [UserRole.USER]: '利用者',
  [UserRole.STAFF]: 'スタッフ',
  [UserRole.ADMIN]: '管理者',
};

export default function MyPage() {
  const { user, isLoading, isAuthenticated, roleLabel, isCognitoEnabled, changeOwnPassword } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<{
    email: string;
    name_kanji: string | null;
    name_kana: string | null;
    role_flag: number;
    org_id: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!isAuthenticated) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    apiClient
      .getMe()
      .then((res) => {
        if (!cancelled) setProfile(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'プロフィールの取得に失敗しました');
          setProfile(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <LoadingSpinner fullScreen text="読み込み中..." />;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (newPassword.length < 8) {
      setPwError('新しいパスワードは8文字以上にしてください。');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('新しいパスワードと確認用が一致しません。');
      return;
    }
    setPwSubmitting(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      setPwSuccess('パスワードを更新しました。');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'パスワードの変更に失敗しました');
    } finally {
      setPwSubmitting(false);
    }
  };

  const displayRole = profile ? roleLabels[profile.role_flag] ?? roleLabel : roleLabel;
  const roleBadgeClass =
    displayRole === '管理者'
      ? 'bg-purple-100 text-purple-800'
      : displayRole === 'スタッフ'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-gray-100 text-gray-800';

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">マイページ</h1>
          <Link
            href="/home"
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            ホームに戻る
          </Link>
        </div>

        {error && (
          <ErrorAlert
            message={error}
            onDismiss={() => setError('')}
            className="mb-4"
          />
        )}

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">アカウント情報</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">メールアドレス</dt>
                <dd className="font-medium">
                  {profile?.email ?? user.signInDetails?.loginId ?? user.username ?? '-'}
                </dd>
              </div>
              {profile?.name_kanji != null && profile.name_kanji !== '' && (
                <div>
                  <dt className="text-sm text-gray-500">氏名（漢字）</dt>
                  <dd className="font-medium">{profile.name_kanji}</dd>
                </div>
              )}
              {profile?.name_kana != null && profile.name_kana !== '' && (
                <div>
                  <dt className="text-sm text-gray-500">氏名（かな）</dt>
                  <dd className="font-medium">{profile.name_kana}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500">付与されている権限</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${roleBadgeClass}`}
                  >
                    {displayRole}
                  </span>
                </dd>
              </div>
              {profile?.org_id != null && profile.org_id !== '' && (
                <div>
                  <dt className="text-sm text-gray-500">組織ID</dt>
                  <dd className="font-medium">{profile.org_id}</dd>
                </div>
              )}
            </dl>
          </section>

          {isCognitoEnabled && (
            <section className="border-t border-gray-200 pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">パスワード変更</h2>
              <p className="text-sm text-gray-600 mb-4">
                Cognito に登録されているログインパスワードを変更します。現在のパスワードを入力してください。利用者（生徒）・スタッフ・管理者のいずれのアカウントでも利用できます。
              </p>
              {pwSuccess && (
                <SuccessAlert
                  message={pwSuccess}
                  onDismiss={() => setPwSuccess('')}
                  className="mb-4"
                />
              )}
              {pwError && (
                <ErrorAlert
                  message={pwError}
                  onDismiss={() => setPwError('')}
                  className="mb-4"
                />
              )}
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <div>
                  <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
                    現在のパスワード
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                    新しいパスワード（8文字以上）
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                    新しいパスワード（確認用）
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <LoadingButton type="submit" loading={pwSubmitting} variant="primary" className="w-full sm:w-auto">
                  パスワードを更新
                </LoadingButton>
              </form>
            </section>
          )}

          {!isCognitoEnabled && (
            <section className="border-t border-gray-200 pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">パスワード変更</h2>
              <p className="text-sm text-gray-600">
                この環境では Cognito が無効のため、画面からパスワードを変更できません（ローカル開発用のログインなど）。
              </p>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">便利なリンク</h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/my-qr"
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  📱 打刻用QR表示（受付用QRコードの表示）
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  📅 イベント一覧（公開中のイベント閲覧・申し込み）
                </Link>
              </li>
              <li>
                <Link
                  href="/history"
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  📊 打刻履歴を見る
                </Link>
              </li>
              <li>
                <Link
                  href="/user/registrations"
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  📝 参加申込一覧を見る
                </Link>
              </li>
              <li>
                <Link
                  href="/schedule"
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  📆 スケジュールを見る
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
