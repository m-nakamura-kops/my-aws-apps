'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';

interface Event {
  event_id: number;
  event_name: string;
  event_date: string;
  location: string | null;
  capacity: number | null;
  summary: string | null;
}

function ReportsPageContent() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.listEvents({ limit: 200 });
      setEvents(response.events || []);
    } catch (err: any) {
      setError(err.message || 'イベントの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">レポート出力</h1>
            <p className="text-lg text-gray-600">
              イベント別の出席レポートを確認・出力できます
            </p>
          </div>
          <Link
            href="/home"
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            ホームに戻る
          </Link>
        </div>

        {error && (
          <ErrorAlert message={error} onDismiss={() => setError('')} className="mb-6" />
        )}

        {loading ? (
          <LoadingSpinner fullScreen text="イベント一覧を読み込み中..." />
        ) : events.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">イベントがありません</p>
            <p className="text-sm text-gray-500 mb-6">
              イベント管理からイベントを作成すると、ここで出席レポートを出力できます
            </p>
            <Link
              href="/admin/events"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              イベント管理へ
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">イベント一覧（出席レポートへ）</h2>
              <p className="text-sm text-gray-500 mt-1">
                イベントを選択して出席レポートを表示・確認します
              </p>
            </div>
            <ul className="divide-y divide-gray-200">
              {events.map((event) => (
                <li key={event.event_id} className="hover:bg-gray-50">
                  <Link
                    href={`/admin/events/${event.event_id}/attendance-report`}
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{event.event_name}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {formatDate(event.event_date)}
                        {event.location && ` ・ ${event.location}`}
                      </p>
                    </div>
                    <span className="text-indigo-600 font-medium">
                      レポートを見る →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ReportsPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
      <ReportsPageContent />
    </RoleGuard>
  );
}
