'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import SuccessAlert from '@/components/ui/SuccessAlert';
import LoadingButton from '@/components/ui/LoadingButton';

interface Event {
  event_id: number;
  event_name: string;
  event_date: string;
  location: string | null;
  capacity: number | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

interface Registration {
  reg_id: number;
  email: string;
  user_name: string;
  event_id: number;
  event_name: string;
  event_date: string;
  location: string | null;
  capacity: number | null;
  registration_date: string;
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const eventId = params?.eventId ? parseInt(params.eventId as string, 10) : null;

  const [event, setEvent] = useState<Event | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRegistrations, setCurrentRegistrations] = useState<number>(0);

  useEffect(() => {
    if (!eventId) {
      setError('イベントIDが無効です');
      setLoading(false);
      return;
    }

    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    if (!eventId) return;

    try {
      setLoading(true);
      setError(null);

      // イベント情報を取得（認証済みユーザー用のイベント一覧APIを使用）
      const eventsResponse = await apiClient.listEventsForStaff({ limit: 1000 });
      const foundEvent = eventsResponse.events.find((e: Event) => e.event_id === eventId);

      if (!foundEvent) {
        setError('イベントが見つかりません');
        setLoading(false);
        return;
      }

      setEvent(foundEvent);

      // ユーザーがログインしている場合のみ申込情報を取得
      if (user?.signInDetails?.loginId || user?.username) {
        const userEmail = user.signInDetails?.loginId || user.username || '';
        if (userEmail) {
          try {
            const registrationsResponse = await apiClient.getRegistrations({
              email: userEmail,
              event_id: eventId,
            });

            if (registrationsResponse.registrations.length > 0) {
              setRegistration(registrationsResponse.registrations[0]);
            }
          } catch (regErr) {
            // 申込情報の取得に失敗してもイベント情報は表示する
            console.warn('Failed to load registration:', regErr);
          }
        }
      }

      // イベントの総申込数を取得（管理者用のAPIが必要ですが、簡易的に申込一覧から取得）
      // 実際には管理者用APIが必要ですが、今回は簡易実装
    } catch (err: any) {
      console.error('Failed to load event data:', err);
      setError(err.message || 'イベント情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!eventId || !user) {
      setError('ログインが必要です');
      return;
    }

    const userEmail = user.signInDetails?.loginId || user.username || '';
    if (!userEmail) {
      setError('ユーザー情報を取得できませんでした');
      return;
    }

    try {
      setRegistering(true);
      setError(null);

      await apiClient.registerForEvent(eventId, userEmail);
      
      // 申込情報を再取得
      await loadEventData();
    } catch (err: any) {
      console.error('Failed to register:', err);
      setError(err.message || '参加申込に失敗しました');
    } finally {
      setRegistering(false);
    }
  };

  const handleUnregister = async () => {
    if (!eventId || !user) {
      setError('ログインが必要です');
      return;
    }

    const userEmail = user.signInDetails?.loginId || user.username || '';
    if (!userEmail) {
      setError('ユーザー情報を取得できませんでした');
      return;
    }

    if (!confirm('参加申込を取消しますか？')) {
      return;
    }

    try {
      setRegistering(true);
      setError(null);

      await apiClient.unregisterFromEvent(eventId, userEmail);
      
      // 申込情報を再取得
      setRegistration(null);
      await loadEventData();
    } catch (err: any) {
      console.error('Failed to unregister:', err);
      setError(err.message || '参加取消に失敗しました');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="イベント情報を読み込み中..." />;
  }

  if (error && !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <ErrorAlert 
            message={error} 
            onRetry={loadEventData}
            className="mb-4"
          />
          <button
            onClick={() => router.push('/events')}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            イベント一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  const eventDate = new Date(event.event_date);
  const isRegistered = registration !== null;
  const isFull = event.capacity !== null && currentRegistrations >= event.capacity;
  const canRegister = !isRegistered && !isFull;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/events')}
            className="text-indigo-600 hover:text-indigo-800 mb-4"
          >
            ← イベント一覧に戻る
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{event.event_name}</h1>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <ErrorAlert 
            message={error} 
            onDismiss={() => setError(null)}
            className="mb-4"
          />
        )}

        {/* イベント詳細 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-gray-500">開催日時</h2>
              <p className="mt-1 text-lg text-gray-900">
                {eventDate.toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
                {' '}
                {eventDate.toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            {event.location && (
              <div>
                <h2 className="text-sm font-medium text-gray-500">開催場所</h2>
                <p className="mt-1 text-lg text-gray-900">{event.location}</p>
              </div>
            )}

            {event.capacity !== null && (
              <div>
                <h2 className="text-sm font-medium text-gray-500">定員</h2>
                <p className="mt-1 text-lg text-gray-900">
                  {currentRegistrations} / {event.capacity} 名
                  {isFull && <span className="ml-2 text-red-600">（満員）</span>}
                </p>
              </div>
            )}

            {event.summary && (
              <div>
                <h2 className="text-sm font-medium text-gray-500">概要</h2>
                <p className="mt-1 text-gray-900 whitespace-pre-wrap">{event.summary}</p>
              </div>
            )}
          </div>
        </div>

        {/* 参加申込ボタン */}
        {user ? (
          <div className="bg-white shadow rounded-lg p-6">
            {isRegistered ? (
              <div>
                <div className="mb-4">
                  <p className="text-green-600 font-medium mb-2">
                    ✓ このイベントに参加申込済みです
                  </p>
                  <p className="text-sm text-gray-600">
                    申込日時: {new Date(registration.registration_date).toLocaleString('ja-JP')}
                  </p>
                  <Link
                    href={`/admin/events/${eventId}/participants`}
                    className="inline-block mt-2 text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    自分の出欠確認を見る →
                  </Link>
                </div>
                <LoadingButton
                  onClick={handleUnregister}
                  loading={registering}
                  variant="danger"
                  className="w-full"
                >
                  参加申込を取消
                </LoadingButton>
              </div>
            ) : (
              <div>
                {isFull ? (
                  <p className="text-red-600 font-medium mb-4">
                    このイベントは満員です
                  </p>
                ) : (
                  <LoadingButton
                    onClick={handleRegister}
                    loading={registering}
                    disabled={!canRegister}
                    variant="primary"
                    className="w-full"
                  >
                    このイベントに参加申込
                  </LoadingButton>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-gray-600 mb-4">参加申込にはログインが必要です</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              ログイン
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
