'use client';

/**
 * No.6.4.7 利用者：スケジュール (/schedule)
 * 申込イベント＋打刻状況（月別）。Android実機向けカード形式・タップ領域44px以上。
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';

interface ScheduleItem {
  event_id: number;
  event_name: string;
  event_date: string;
  location: string | null;
  capacity: number | null;
  summary: string | null;
  is_registered: boolean;
  is_attended: boolean;
}

function getMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
}

function getPrevMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getNextMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m ?? 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function SchedulePage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [month, setMonth] = useState(() => getCurrentMonth());
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [monthLabel, setMonthLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSchedule = useCallback(async (monthParam: string) => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.getSchedule(monthParam);
      setSchedule(res.schedule ?? []);
      setMonthLabel(res.month ?? monthParam);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'スケジュールの取得に失敗しました');
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) loadSchedule(month);
  }, [authLoading, isAuthenticated, router, month, loadSchedule]);

  const formatEventDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  };

  const formatEventTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading) {
    return <LoadingSpinner fullScreen text="認証を確認中..." />;
  }
  if (!isAuthenticated) return null;

  return (
    <main className="min-h-screen p-4 sm:p-6 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">スケジュール</h1>
            <p className="text-gray-600 text-sm sm:text-base mt-1">申し込んだイベントと打刻状況（月別）</p>
          </div>
          <Link
            href="/home"
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
          >
            ホームに戻る
          </Link>
        </div>

        <div className="flex items-center justify-between gap-4 mb-6">
          <button
            type="button"
            onClick={() => setMonth(getPrevMonth(month))}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 font-medium hover:bg-gray-50"
            aria-label="前月"
          >
            ◀ 前月
          </button>
          <span className="text-lg font-semibold text-gray-900">
            {getMonthLabel(monthLabel || month)}
          </span>
          <button
            type="button"
            onClick={() => setMonth(getNextMonth(month))}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 font-medium hover:bg-gray-50"
            aria-label="翌月"
          >
            翌月 ▶
          </button>
        </div>

        {error && (
          <ErrorAlert
            message={error}
            onRetry={() => loadSchedule(month)}
            onDismiss={() => setError('')}
            className="mb-4"
          />
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner text="読み込み中..." />
          </div>
        ) : schedule.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center border border-gray-100">
            <p className="text-gray-600">この月の申込イベントはありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {schedule.map((item) => (
              <article
                key={item.event_id}
                className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden"
              >
                <div className="p-4 sm:p-5">
                  <p className="text-sm text-gray-500 mb-1">
                    {formatEventDate(item.event_date)} {formatEventTime(item.event_date)}
                  </p>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    {item.event_name}
                  </h2>
                  <dl className="space-y-1 text-sm text-gray-600 mb-4">
                    {item.location && (
                      <div>
                        <span className="text-gray-500">場所: </span>
                        {item.location}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>申込: ✓</span>
                      <span>
                        出席: {item.is_attended ? (
                          <span className="text-green-600 font-medium">✓ 出席済み</span>
                        ) : (
                          <span className="text-gray-500">未打刻</span>
                        )}
                      </span>
                    </div>
                  </dl>
                  <Link
                    href={`/events/${item.event_id}`}
                    className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 text-indigo-600 font-medium border border-indigo-200 rounded-md hover:bg-indigo-50"
                  >
                    詳細を見る
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
