'use client';

import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function HomeClient() {
  const { isAuthenticated, isLoading, user, logout, isAdmin, isStaff, roleLabel } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <LoadingSpinner fullScreen text="認証情報を確認中..." />;
  }

  if (!isAuthenticated) {
    return <LoadingSpinner fullScreen text="ログインへリダイレクトしています..." />;
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              QRコード打刻システム
            </h1>
            <p className="text-lg text-gray-600 flex items-center gap-3 flex-wrap">
              <span>ようこそ、{user?.signInDetails?.loginId || 'ユーザー'}さん</span>
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
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/user/me"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              マイページ
            </Link>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              ログアウト
            </button>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-1">機能</h2>
          <p className="text-sm text-gray-500 mb-4">現在の権限: {roleLabel}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isAdmin && (
              <>
                <Link
                  href="/admin/events"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
                >
                  <h3 className="font-semibold text-lg mb-2">📅 イベント管理</h3>
                  <p className="text-gray-600 text-sm">
                    イベントの作成・編集・削除ができます
                  </p>
                </Link>
                <Link
                  href="/admin/registrations"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
                >
                  <h3 className="font-semibold text-lg mb-2">📋 参加申込一覧（全利用者）</h3>
                  <p className="text-gray-600 text-sm">
                    全ての利用者のイベント参加申込を確認できます
                  </p>
                </Link>
                <Link
                  href="/admin/students"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
                >
                  <h3 className="font-semibold text-lg mb-2">👥 生徒名簿管理</h3>
                  <p className="text-gray-600 text-sm">
                    生徒の登録・編集・削除ができます
                  </p>
                </Link>
                <Link
                  href="/admin/staffs"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
                >
                  <h3 className="font-semibold text-lg mb-2">👔 スタッフ管理</h3>
                  <p className="text-gray-600 text-sm">
                    スタッフの招待・編集・削除ができます
                  </p>
                </Link>
              </>
            )}
            <Link
              href="/my-qr"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
            >
              <h3 className="font-semibold text-lg mb-2">📱 打刻用QR表示</h3>
              <p className="text-gray-600 text-sm">
                受付用QRコードの表示
              </p>
            </Link>
            <Link
              href="/user/events"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
            >
              <h3 className="font-semibold text-lg mb-2">📅 イベント一覧</h3>
              <p className="text-gray-600 text-sm">
                公開中のイベント閲覧・申し込み
              </p>
            </Link>
            {(isStaff || isAdmin) && (
              <Link
                href="/staff/scan"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
              >
                <h3 className="font-semibold text-lg mb-2">📷 打刻スキャン（スタッフ用）</h3>
                <p className="text-gray-600 text-sm">
                  PC・タブレットで利用者のQRをスキャンして打刻します
                </p>
              </Link>
            )}
            <Link
              href="/history"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
            >
              <h3 className="font-semibold text-lg mb-2">📊 打刻履歴</h3>
              <p className="text-gray-600 text-sm">
                あなたの打刻履歴を確認できます
              </p>
            </Link>
            <Link
              href="/user/registrations"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
            >
              <h3 className="font-semibold text-lg mb-2">📝 参加申込一覧</h3>
              <p className="text-gray-600 text-sm">
                あなたが申し込んだイベントの一覧を確認できます
              </p>
            </Link>
            {isAdmin ? (
              <Link
                href="/admin/reports"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
              >
                <h3 className="font-semibold text-lg mb-2">📄 レポート出力</h3>
                <p className="text-gray-600 text-sm">
                  イベント別の出席レポートを確認・出力できます
                </p>
              </Link>
            ) : (
              <div className="p-4 border border-gray-200 rounded-lg opacity-50">
                <h3 className="font-semibold text-lg mb-2">📄 レポート出力</h3>
                <p className="text-gray-600 text-sm">管理者のみ利用できます</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
