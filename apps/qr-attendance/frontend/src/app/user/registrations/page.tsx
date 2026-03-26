'use client';

/**
 * No.6.4.6 利用者：参加申込一覧 (/user/registrations)
 * 自分が申し込んだイベント一覧・取消。Android実機向けカード形式・タップ領域44px以上。
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import LoadingButton from '@/components/ui/LoadingButton';

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

function RegistrationsPageContent() {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unregisteringId, setUnregisteringId] = useState<number | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 100,
    offset: 0,
    hasMore: false,
  });

  const loadRegistrations = useCallback(async (offset: number = 0) => {
    if (!user) return;

    const userEmail = user.signInDetails?.loginId || user.username || undefined;
    try {
      setLoading(true);
      setError('');
      const limit = 100;
      const response = await apiClient.getRegistrations({
        ...(userEmail ? { email: userEmail } : {}),
        limit,
        offset,
      });

      if (offset === 0) {
        setRegistrations(response.registrations);
      } else {
        setRegistrations((prev) => [...prev, ...response.registrations]);
      }
      setPagination(response.pagination);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '申込一覧の取得に失敗しました';
      setError(msg);
      if (offset === 0) {
        setRegistrations([]);
        setPagination((p) => ({ ...p, total: 0, hasMore: false }));
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadRegistrations(0);
  }, [user, loadRegistrations]);

  const handleUnregister = useCallback(
    async (reg: Registration) => {
      const userEmail = user?.signInDetails?.loginId || user?.username || '';
      if (!userEmail) {
        setError('ユーザー情報を取得できませんでした。');
        return;
      }
      if (!confirm('参加申込を取消しますか？')) return;

      try {
        setUnregisteringId(reg.reg_id);
        setError('');
        await apiClient.unregisterFromEvent(reg.event_id, userEmail);
        setRegistrations((prev) => prev.filter((r) => r.reg_id !== reg.reg_id));
        setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '参加申込の取消に失敗しました');
      } finally {
        setUnregisteringId(null);
      }
    },
    [user]
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateOnly = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">参加申込一覧</h1>
            <p className="text-gray-600 text-sm sm:text-base mt-1">あなたが申し込んだイベントの一覧です</p>
          </div>
          <Link
            href="/home"
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
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

        {loading && registrations.length === 0 ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner text="読み込み中..." />
          </div>
        ) : registrations.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-gray-600">申し込んだイベントはありません</p>
            <Link
              href="/events"
              className="mt-4 inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
            >
              イベント一覧を見る
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {registrations.map((reg) => (
              <article
                key={reg.reg_id}
                className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden"
              >
                <div className="p-4 sm:p-5">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    {reg.event_name}
                  </h2>
                  <dl className="space-y-1 text-sm text-gray-600 mb-4">
                    <div>
                      <span className="text-gray-500">開催: </span>
                      {formatDateOnly(reg.event_date)}
                      <span className="ml-1">
                        {new Date(reg.event_date).toLocaleTimeString('ja-JP', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {reg.location && (
                      <div>
                        <span className="text-gray-500">場所: </span>
                        {reg.location}
                      </div>
                    )}
                    {reg.capacity != null && (
                      <div>
                        <span className="text-gray-500">定員: </span>
                        {reg.capacity}人
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">申込日時: </span>
                      {formatDate(reg.registration_date)}
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/events/${reg.event_id}`}
                      className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 text-indigo-600 font-medium border border-indigo-200 rounded-md hover:bg-indigo-50"
                    >
                      詳細を見る
                    </Link>
                    <LoadingButton
                      onClick={() => handleUnregister(reg)}
                      loading={unregisteringId === reg.reg_id}
                      disabled={unregisteringId !== null}
                      variant="danger"
                      className="min-h-[44px] px-4 py-2.5"
                    >
                      参加申込を取消
                    </LoadingButton>
                  </div>
                </div>
              </article>
            ))}
            {pagination.total > 0 && (
              <div className="bg-white rounded-xl shadow px-4 py-4 border border-gray-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-700">
                    {Math.min(pagination.offset + registrations.length, pagination.total)} / {pagination.total} 件
                  </p>
                  {pagination.hasMore && (
                    <LoadingButton
                      onClick={() => loadRegistrations(pagination.offset + pagination.limit)}
                      loading={loading}
                      variant="primary"
                      className="min-h-[44px] px-5"
                    >
                      もっと見る
                    </LoadingButton>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function RegistrationsPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.USER, UserRole.STAFF, UserRole.ADMIN]}>
      <RegistrationsPageContent />
    </RoleGuard>
  );
}
