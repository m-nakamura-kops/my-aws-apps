'use client';

/**
 * No.6.4.5 利用者：打刻履歴 (/history)
 * 自分の出席記録一覧。GET /v1/users/attendance/history（本人のみ）。
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import TableSkeleton from '@/components/ui/TableSkeleton';

interface AttendanceLog {
  log_id: number;
  email: string;
  user_name: string;
  event_id: number;
  event_name: string;
  event_date: string;
  in_time: string;
  out_time: string | null;
  stay_minutes: number | null;
  staff_email: string;
  staff_name: string;
  created_at: string;
}

export default function HistoryPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 100,
    offset: 0,
    hasMore: false,
  });
  const [filters, setFilters] = useState({
    event_id: '',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadHistory();
    }
  }, [isAuthenticated, user, filters, pagination.offset, pagination.limit]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError('');

      const userEmail = user?.signInDetails?.loginId || (user as any)?.username || '';
      const params: any = {
        limit: pagination.limit,
        offset: pagination.offset,
      };
      // 権限マトリクス: 自分の打刻履歴の閲覧は全ロールとも本人のみ
      if (!userEmail) {
        setError('ユーザー情報を取得できませんでした。');
        setLoading(false);
        return;
      }
      params.email = userEmail;

      if (filters.event_id) {
        params.event_id = parseInt(filters.event_id, 10);
      }
      if (filters.start_date) {
        params.start_date = filters.start_date;
      }
      if (filters.end_date) {
        params.end_date = filters.end_date;
      }

      const response = await apiClient.getAttendanceHistory(params);
      setLogs(response.logs);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.message || '打刻履歴の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}時間${mins}分`;
    }
    return `${mins}分`;
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, offset: 0 });
  };

  const handleResetFilters = () => {
    setFilters({
      event_id: '',
      start_date: '',
      end_date: '',
    });
    setPagination({ ...pagination, offset: 0 });
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="認証情報を確認中..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">打刻履歴</h1>
            <p className="text-lg text-gray-600">
              あなたの打刻履歴を確認できます
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
          <ErrorAlert 
            message={error} 
            onRetry={loadHistory}
            onDismiss={() => setError('')}
            className="mb-4"
          />
        )}

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">フィルター</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                イベントID
              </label>
              <input
                type="number"
                value={filters.event_id}
                onChange={(e) => handleFilterChange('event_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="例: 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                開始日
              </label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                終了日
              </label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleResetFilters}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                リセット
              </button>
            </div>
          </div>
        </div>

        {/* 履歴一覧 */}
        {loading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">打刻履歴がありません</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        イベント名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        打刻ユーザー
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        入室時刻
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        退室時刻
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        滞在時間
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        担当者
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.log_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {log.event_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {log.event_id}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {log.user_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {log.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDateTime(log.in_time)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.out_time ? formatDateTime(log.out_time) : <span className="text-gray-400">未退室</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDuration(log.stay_minutes)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {log.staff_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {log.staff_email}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ページネーション */}
            {pagination.total > pagination.limit && (
              <div className="mt-6 flex justify-between items-center">
                <div className="text-sm text-gray-700">
                  全 {pagination.total} 件中 {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} 件を表示
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newOffset = Math.max(0, pagination.offset - pagination.limit);
                      setPagination({ ...pagination, offset: newOffset });
                    }}
                    disabled={pagination.offset === 0}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    前へ
                  </button>
                  <button
                    onClick={() => {
                      const newOffset = pagination.offset + pagination.limit;
                      setPagination({ ...pagination, offset: newOffset });
                    }}
                    disabled={!pagination.hasMore}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
