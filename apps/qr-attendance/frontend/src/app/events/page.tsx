'use client';

/**
 * No.6.4.2 利用者：イベント一覧 (/events)
 * 公開されているイベントをカード形式で一覧表示。申込入口・イベント名表示。
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';

interface EventItem {
  event_id: number;
  event_name: string;
  event_date: string;
  location: string | null;
  capacity: number | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export default function EventsPage() {
  const { isAuthenticated, isLoading, isStaff, isAdmin } = useAuth();
  const router = useRouter();
  const showAttendanceLink = isStaff || isAdmin;
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) {
      loadEvents();
    }
  }, [isAuthenticated, isLoading, router]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.listEventsForStaff({ limit: 100 });
      setEvents(response.events ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'イベント一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="認証情報を確認中..." />;
  }
  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">イベント一覧</h1>
            <p className="text-gray-600">公開中のイベントを確認し、申し込みができます</p>
          </div>
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
            onRetry={loadEvents}
            onDismiss={() => setError('')}
            className="mb-4"
          />
        )}

        {loading ? (
          <div className="text-center py-12">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">読み込み中...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <p className="text-gray-600 mb-4">現在、申し込み可能なイベントはありません</p>
            <Link
              href="/home"
              className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              ホームに戻る
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
            {events.map((event) => (
              <div
                key={event.event_id}
                className="bg-white rounded-xl shadow hover:shadow-md border border-gray-100 overflow-hidden transition-all hover:border-indigo-200 flex flex-col"
              >
                <Link href={`/events/${event.event_id}`} className="block flex-1 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
                    {event.event_name}
                  </h2>
                  <p className="text-sm text-gray-500 mb-2">
                    📅 {formatDate(event.event_date)}
                  </p>
                  {event.location && (
                    <p className="text-sm text-gray-600 mb-2">📍 {event.location}</p>
                  )}
                  {event.summary && (
                    <p className="text-gray-600 text-sm line-clamp-2 mb-3">{event.summary}</p>
                  )}
                  <div className="flex items-center justify-between">
                    {event.capacity != null && (
                      <span className="text-xs text-gray-500">定員: {event.capacity}人</span>
                    )}
                    <span className="text-indigo-600 font-medium text-sm">
                      詳細・申し込む →
                    </span>
                  </div>
                </Link>
                {showAttendanceLink && (
                  <div className="px-6 pb-4 pt-0 border-t border-gray-100 mt-auto">
                    <Link
                      href={`/admin/events/${event.event_id}/participants`}
                      className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 w-full sm:w-auto bg-amber-500 text-white rounded-md hover:bg-amber-600 font-medium text-sm"
                    >
                      出席確認画面へ
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
