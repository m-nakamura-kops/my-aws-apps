'use client';

/**
 * ホーム画面（WBS 2-3 ホーム画面・役割別メニュー表示）
 *
 * FE_2-3_HOME_MENU_DESIGN.md に基づき、役割（利用者/スタッフ/管理者）に応じて
 * カード型メニューを動的に出し分ける。権限マトリックス準拠。
 * 公開かつ掲載期間内のお知らせが1件以上ある場合、上部に「重要なお知らせ」を表示（6.4.16）。
 */

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import RoleBadge from '@/components/home/RoleBadge';
import { apiClient } from '@/lib/api-client';

type MenuVisibility = 'all' | 'staff' | 'admin';

interface MenuItem {
  label: string;
  path: string;
  description: string;
  icon: string;
  showWhen: MenuVisibility;
}

const MENU_ITEMS: MenuItem[] = [
  // 全役割（認証共通・利用者向け）
  { label: '打刻用QR表示', path: '/my-qr', description: '受付でスタッフにスキャンしてもらうQR', icon: '📱', showWhen: 'all' },
  { label: 'イベント一覧', path: '/events', description: '公開イベント閲覧・申込', icon: '📅', showWhen: 'all' },
  { label: '打刻履歴', path: '/history', description: '自分の打刻履歴', icon: '📊', showWhen: 'all' },
  { label: '参加申込一覧', path: '/user/registrations', description: '自分が申し込んだイベント', icon: '📝', showWhen: 'all' },
  { label: 'スケジュール', path: '/schedule', description: '申込イベント＋打刻状況（月別）', icon: '📆', showWhen: 'all' },
  { label: 'マイページ', path: '/user/me', description: '自分のプロフィール', icon: '👤', showWhen: 'all' },
  // スタッフ以上
  { label: '打刻スキャン（スタッフ用）', path: '/staff/scan', description: '利用者QRをスキャンして打刻', icon: '📷', showWhen: 'staff' },
  { label: '手動打刻', path: '/staff/manual', description: '登録済み生徒の検索→イベント選択→手動打刻', icon: '✏️', showWhen: 'staff' },
  // 管理者のみ
  { label: 'イベント管理', path: '/admin/events', description: 'イベントCRUD・QR・出席レポート', icon: '📅', showWhen: 'admin' },
  { label: '生徒名簿管理', path: '/admin/students', description: '生徒一覧・新規登録・編集・削除・CSV取込', icon: '👥', showWhen: 'admin' },
  { label: 'スタッフ管理', path: '/admin/staffs', description: 'スタッフ一覧・招待・権限変更', icon: '👔', showWhen: 'admin' },
  { label: '参加申込一覧（全利用者）', path: '/admin/registrations', description: '全ての利用者のイベント参加申込', icon: '📋', showWhen: 'admin' },
  { label: 'レポート出力', path: '/admin/reports', description: 'イベント別の出席CSVダウンロード', icon: '📄', showWhen: 'admin' },
  { label: 'お知らせ管理', path: '/admin/announcements', description: 'お知らせの作成・編集・削除', icon: '📢', showWhen: 'staff' },
];

function filterMenuItems(items: MenuItem[], isStaff: boolean, isAdmin: boolean): MenuItem[] {
  return items.filter((item) => {
    if (item.showWhen === 'all') return true;
    if (item.showWhen === 'staff') return isStaff || isAdmin;
    if (item.showWhen === 'admin') return isAdmin;
    return false;
  });
}

interface NewsItem {
  id: number;
  title: string;
  content: string;
  announcement_type: number;
  published_at: string;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function HomeClient() {
  const { isAuthenticated, isLoading, user, logout, isAdmin, isStaff, roleLabel } = useAuth();
  const router = useRouter();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsError, setNewsError] = useState<string>('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setNewsError('');
    apiClient
      .getNews({ limit: 10 })
      .then((res) => {
        setNews(res.news || []);
        setNewsError('');
      })
      .catch((err) => {
        setNews([]);
        setNewsError(err instanceof Error ? err.message : 'お知らせの取得に失敗しました');
      });
  }, [isAuthenticated]);

  if (isLoading) {
    return <LoadingSpinner fullScreen text="認証情報を確認中..." />;
  }

  if (!isAuthenticated) {
    return <LoadingSpinner fullScreen text="ログインへリダイレクトしています..." />;
  }

  const visibleMenus = filterMenuItems(MENU_ITEMS, isStaff, isAdmin);

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* 重要なお知らせ（1件以上ある場合のみ表示） */}
        {newsError && (
          <section className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
            {newsError}
          </section>
        )}
        {news.length > 0 && (
          <section className="mb-6 rounded-lg border-2 border-amber-200 bg-amber-50/80 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 px-4 pt-4 pb-2">重要なお知らせ</h2>
            <ul className="divide-y divide-amber-200/60 px-4 pb-4">
              {news.map((n) => (
                <li key={n.id} className={`py-3 first:pt-0 ${n.announcement_type === 2 ? 'border-l-4 border-l-red-500 pl-3' : ''}`}>
                  <div className="flex items-start gap-2 flex-wrap">
                    {n.announcement_type === 2 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-300">
                        重要
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-gray-900">{n.title}</span>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{n.content}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ヘッダー: タイトル・挨拶・役割バッジ・マイページ・ログアウト */}
        <header className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-gray-900">
              QRコード打刻システム
            </h1>
            <p className="text-lg text-gray-600 flex items-center gap-3 flex-wrap">
              <span>ようこそ、{user?.signInDetails?.loginId || 'ユーザー'}さん</span>
              <RoleBadge roleLabel={roleLabel} />
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/user/me"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              マイページ
            </Link>
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </header>

        {/* メイン: 役割に応じたメニューカード */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-1 text-gray-900">機能</h2>
          <p className="text-sm text-gray-500 mb-4">現在の権限: {roleLabel}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleMenus.map((item) => (
              <Link
                key={item.path + item.label}
                href={item.path}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-indigo-500 transition-colors"
              >
                <h3 className="font-semibold text-lg mb-2">
                  {item.icon} {item.label}
                </h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
