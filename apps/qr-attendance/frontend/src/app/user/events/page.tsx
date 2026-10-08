'use client';

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

export default function UserEventsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadEvents();
    }
  }, [isAuthenticated]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.listEventsForStaff({ limit: 100 });
      setEvents(response.events || []);
    } catch (err: any) {
      setError(err.message || 'イベント一覧の取得に失敗しました');
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
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">イベント一覧</h1>
            <p className="text-lg text-gray-600">
              公開中のイベント閲覧・申し込み
            </p>
          </div>
          <Link
            href="/"
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
            <p className="mt-4 text-gray-600">読み込み中...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">現在、申し込み可能なイベントはありません</p>
            <Link
              href="/"
              className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              ホームに戻る
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <Link
                key={event.event_id}
                href={`/events/${event.event_id}`}
                className="block bg-white rounded-lg shadow p-6 hover:shadow-md hover:border-indigo-200 border border-transparent transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">
                      {event.event_name}
                    </h2>
                    <p className="text-sm text-gray-500 mb-2">
                      {formatDate(event.event_date)}
                      {event.location && ` ・ ${event.location}`}
                    </p>
                    {event.summary && (
                      <p className="text-gray-600 text-sm line-clamp-2">
                        {event.summary}
                      </p>
                    )}
                    {event.capacity != null && (
                      <p className="text-sm text-gray-500 mt-2">定員: {event.capacity}人</p>
                    )}
                  </div>
                  <span className="text-indigo-600 font-medium shrink-0">
                    詳細・申し込む →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
