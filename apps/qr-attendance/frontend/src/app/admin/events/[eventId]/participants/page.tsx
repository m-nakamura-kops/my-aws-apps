'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import TableSkeleton from '@/components/ui/TableSkeleton';
import LoadingButton from '@/components/ui/LoadingButton';

interface Participant {
  email: string;
  name_kanji: string;
  name_kana: string;
  tel: string | null;
  org_id: string | null;
  role_flag: number | null;
  registration_date: string;
}

function EventParticipantsPageContent() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading, role } = useAuth();
  const eventId = params?.eventId ? parseInt(params.eventId as string, 10) : null;
  const isUserOnly = role === UserRole.USER; // 利用者は自身の打刻状況のみ（権限マトリクス）
  const isAdmin = role === UserRole.ADMIN;   // レポート出力は管理者のみ（権限マトリクス）

  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 100,
    offset: 0,
    hasMore: false,
  });


  useEffect(() => {
    if (eventId) {
      loadParticipants();
    }
  }, [eventId]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const loadParticipants = async (offset: number = 0) => {
    if (!eventId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.getEventParticipants(eventId, {
        limit: pagination.limit,
        offset: offset,
      });

      setEventName(response.event_name);
      setEventDate(response.event_date);
      
      if (offset === 0) {
        setParticipants(response.participants);
      } else {
        setParticipants((prev) => [...prev, ...response.participants]);
      }
      setPagination(response.pagination);
    } catch (err: any) {
      console.error('Failed to load participants:', err);
      setError(err.message || '参加者一覧の取得に失敗しました');
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleName = (roleFlag: number | null) => {
    if (roleFlag === null) return '-';
    switch (roleFlag) {
      case 1:
        return '利用者';
      case 2:
        return 'スタッフ等';
      case 3:
        return '管理者';
      default:
        return '-';
    }
  };

  if (isLoading || loading) {
    return <LoadingSpinner fullScreen text="認証情報を確認中..." />;
  }

  if (error && !eventName) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <ErrorAlert 
            message={error} 
            onRetry={loadParticipants}
            className="mb-4"
          />
          <Link
            href="/events"
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            イベント一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href={isUserOnly ? '/user/events' : '/admin/events'}
            className="text-indigo-600 hover:text-indigo-800 mb-4 inline-block"
          >
            ← イベント一覧に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {isUserOnly ? '自分の出欠確認' : '参加者一覧'}
          </h1>
          <p className="text-lg text-gray-600 mt-2">{eventName}</p>
          <p className="text-sm text-gray-500">
            {new Date(eventDate).toLocaleString('ja-JP')}
          </p>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <ErrorAlert 
            message={error} 
            onRetry={() => loadParticipants(0)}
            onDismiss={() => setError(null)}
            className="mb-4"
          />
        )}

        {/* 参加者一覧テーブル */}
        {loading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : participants.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <p className="text-gray-600 text-lg">参加者がいません</p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      氏名（漢字）
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      氏名（カナ）
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      メールアドレス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      電話番号
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      組織ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      役割
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      申込日時
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {participants.map((participant, index) => (
                    <tr key={`${participant.email}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {participant.name_kanji}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {participant.name_kana}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {participant.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {participant.tel || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {participant.org_id || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getRoleName(participant.role_flag)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(participant.registration_date)}
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
                      onClick={() => loadParticipants(pagination.offset + pagination.limit)}
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

        {/* アクションボタン（出席レポートは管理者のみ／権限マトリクス） */}
        <div className="mt-6 flex gap-4">
          {isAdmin && (
            <Link
              href={`/admin/events/${eventId}/attendance-report`}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              出席レポートを見る
            </Link>
          )}
          <Link
            href={isUserOnly ? '/user/events' : '/admin/events'}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            イベント詳細に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function EventParticipantsPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.USER, UserRole.STAFF, UserRole.ADMIN]}>
      <EventParticipantsPageContent />
    </RoleGuard>
  );
}
