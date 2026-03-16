'use client';

import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function MyPage() {
  const { user, isLoading, isAuthenticated, role, isAdmin, isStaff } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return <LoadingSpinner fullScreen text="読み込み中..." />;
  }

  if (!isAuthenticated || !user) {
    router.push('/login');
    return null;
  }

  const email = user.signInDetails?.loginId || user.username || '';
  const roleLabel =
    role === UserRole.ADMIN ? '管理者' : role === UserRole.STAFF ? 'スタッフ' : '利用者';

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">マイページ</h1>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            ホームに戻る
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">アカウント情報</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm text-gray-500">メールアドレス</dt>
                <dd className="font-medium">{email}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">付与されている権限</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      roleLabel === '管理者'
                        ? 'bg-purple-100 text-purple-800'
                        : roleLabel === 'スタッフ'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {roleLabel}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

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
                  href="/user/events"
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
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
