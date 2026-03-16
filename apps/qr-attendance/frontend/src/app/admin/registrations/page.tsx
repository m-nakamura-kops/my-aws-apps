'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import TableSkeleton from '@/components/ui/TableSkeleton';
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

function AdminRegistrationsContent() {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 100,
    offset: 0,
    hasMore: false,
  });

  const loadRegistrations = useCallback(async (offset: number = 0) => {
    try {
      setLoading(true);
      setError('');
      const limit = 100;
      const response = await apiClient.getRegistrations({
        limit,
        offset,
      });
      if (offset === 0) {
        setRegistrations(response.registrations);
      } else {
        setRegistrations((prev) => [...prev, ...response.registrations]);
      }
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.message || '申込一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRegistrations(0);
  }, [loadRegistrations]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateOnly = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">参加申込一覧（管理者）</h1>
            <p className="text-lg text-gray-600">
              全ての利用者の参加申込内容を確認できます
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
            onRetry={() => loadRegistrations(0)}
            onDismiss={() => setError('')}
            className="mb-4"
          />
        )}

        {loading && registrations.length === 0 ? (
          <TableSkeleton rows={5} columns={6} />
        ) : registrations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 text-lg">申込はまだありません</p>
            <Link
              href="/admin/events"
              className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              イベント管理へ
            </Link>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      イベント名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      申込者
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      開催日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      開催場所
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      申込日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {registrations.map((reg) => (
                    <tr key={reg.reg_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/admin/events/${reg.event_id}/participants`}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          {reg.event_name}
                        </Link>
                        <div className="text-xs text-gray-500">ID: {reg.event_id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{reg.user_name}</div>
                        <div className="text-xs text-gray-500">{reg.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDateOnly(reg.event_date)}
                        <div className="text-xs text-gray-500">
                          {new Date(reg.event_date).toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {reg.location || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(reg.registration_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/admin/events/${reg.event_id}/participants`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          参加者一覧
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.total > 0 && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} / {pagination.total} 件
                  </div>
                  {pagination.hasMore && (
                    <LoadingButton
                      onClick={() => loadRegistrations(pagination.offset + pagination.limit)}
                      loading={loading}
                      variant="primary"
                      className="text-sm"
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

export default function AdminRegistrationsPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
      <AdminRegistrationsContent />
    </RoleGuard>
  );
}
