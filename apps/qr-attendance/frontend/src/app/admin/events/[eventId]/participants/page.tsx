'use client';

/**
 * No.6.4.8 スタッフ：出席確認（参加者一覧）(/admin/events/[eventId]/participants)
 * 特定イベントの誰が申込・誰が打刻済みを一覧。Android現場向けカード・検索・未打刻フィルタ。
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import LoadingButton from '@/components/ui/LoadingButton';

interface Participant {
  email: string;
  name_kanji: string;
  name_kana: string;
  tel: string | null;
  org_id: string | null;
  role_flag: number | null;
  registration_date: string;
  in_time: string | null;
  out_time: string | null;
}

function EventParticipantsPageContent() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading, role } = useAuth();
  const eventId = params?.eventId ? parseInt(params.eventId as string, 10) : null;
  const isUserOnly = role === UserRole.USER;
  const isAdmin = role === UserRole.ADMIN;

  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 500,
    offset: 0,
    hasMore: false,
  });
  const [searchKana, setSearchKana] = useState('');
  const [showOnlyUnchecked, setShowOnlyUnchecked] = useState(false);

  const loadParticipants = useCallback(async (offset: number = 0) => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const limit = 500;
      const response = await apiClient.getEventParticipants(eventId, { limit, offset });
      setEventName(response.event_name);
      setEventDate(response.event_date);
      if (offset === 0) {
        setParticipants(response.participants);
      } else {
        setParticipants((prev) => [...prev, ...response.participants]);
      }
      setPagination(response.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '参加者一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) loadParticipants(0);
  }, [eventId, loadParticipants]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  const filteredParticipants = useMemo(() => {
    let list = participants;
    const q = searchKana.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => (p.name_kana || '').toLowerCase().includes(q));
    }
    if (showOnlyUnchecked) {
      list = list.filter((p) => p.in_time == null || p.in_time === '');
    }
    return list;
  }, [participants, searchKana, showOnlyUnchecked]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeOnly = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleName = (roleFlag: number | null) => {
    if (roleFlag === null) return '-';
    switch (roleFlag) {
      case 1: return '利用者';
      case 2: return 'スタッフ等';
      case 3: return '管理者';
      default: return '-';
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="認証情報を確認中..." />;
  }

  if (error && !eventName) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <ErrorAlert message={error} onRetry={() => loadParticipants(0)} className="mb-4" />
          <Link
            href={isUserOnly || role === UserRole.STAFF ? '/events' : '/admin/events'}
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
          >
            イベント一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href={isUserOnly || role === UserRole.STAFF ? '/events' : '/admin/events'}
            className="inline-flex items-center min-h-[44px] text-indigo-600 hover:text-indigo-800 font-medium mb-4"
          >
            ← イベント一覧に戻る
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {isUserOnly ? '自分の出欠確認' : '参加者一覧'}
          </h1>
          <p className="text-base text-gray-600 mt-1">{eventName}</p>
          <p className="text-sm text-gray-500">{new Date(eventDate).toLocaleString('ja-JP')}</p>
        </div>

        {error && (
          <ErrorAlert
            message={error}
            onRetry={() => loadParticipants(0)}
            onDismiss={() => setError(null)}
            className="mb-4"
          />
        )}

        {!isUserOnly && participants.length > 0 && (
          <div className="bg-white rounded-xl shadow border border-gray-100 p-4 mb-4 space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">氏名（かな）で検索</span>
              <input
                type="search"
                value={searchKana}
                onChange={(e) => setSearchKana(e.target.value)}
                placeholder="例: やまだ"
                className="mt-1 block w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md text-base"
              />
            </label>
            <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyUnchecked}
                onChange={(e) => setShowOnlyUnchecked(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">未打刻者のみ表示</span>
            </label>
          </div>
        )}

        {loading && participants.length === 0 ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner text="読み込み中..." />
          </div>
        ) : participants.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center border border-gray-100">
            <p className="text-gray-600">参加者がいません</p>
          </div>
        ) : filteredParticipants.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-6 text-center border border-gray-100">
            <p className="text-gray-600">該当する参加者はいません</p>
            <button
              type="button"
              onClick={() => { setSearchKana(''); setShowOnlyUnchecked(false); }}
              className="mt-3 inline-flex items-center justify-center min-h-[44px] px-4 py-2 text-indigo-600 font-medium"
            >
              フィルタを解除
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredParticipants.map((p, index) => {
              const hasPunched = p.in_time != null && p.in_time !== '';
              return (
                <article
                  key={`${p.email}-${index}`}
                  className={`rounded-xl shadow border overflow-hidden ${
                    hasPunched ? 'bg-white border-green-100' : 'bg-white border-orange-100'
                  }`}
                >
                  <div className="p-4 sm:p-5">
                    <div className={`text-sm font-semibold mb-2 ${hasPunched ? 'text-green-700' : 'text-orange-700'}`}>
                      {hasPunched ? (
                        <>
                          ✓ 入室 {formatTimeOnly(p.in_time!)}
                          {p.out_time && <>　退室 {formatTimeOnly(p.out_time)}</>}
                        </>
                      ) : (
                        '未打刻'
                      )}
                    </div>
                    <p className="text-base font-medium text-gray-900">
                      {p.name_kanji || '-'}
                      {(p.name_kana && p.name_kana !== p.name_kanji) && (
                        <span className="text-gray-500 font-normal ml-1">（{p.name_kana}）</span>
                      )}
                    </p>
                    <dl className="mt-2 space-y-0.5 text-sm text-gray-600">
                      <div>メール: {p.email}</div>
                      <div>申込: {formatDate(p.registration_date)}</div>
                      {p.tel && <div>電話: {p.tel}</div>}
                      {p.org_id && <div>組織ID: {p.org_id}</div>}
                      <div>役割: {getRoleName(p.role_flag)}</div>
                    </dl>
                  </div>
                </article>
              );
            })}
            {pagination.total > 0 && (
              <div className="bg-white rounded-xl shadow px-4 py-4 border border-gray-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-700">
                    {filteredParticipants.length} 件表示
                    {filteredParticipants.length !== participants.length && ` / 全 ${participants.length} 件`}
                    {participants.length < pagination.total && `（API全 ${pagination.total} 件中）`}
                  </p>
                  {pagination.hasMore && (
                    <LoadingButton
                      onClick={() => loadParticipants(pagination.offset + pagination.limit)}
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

        <div className="mt-6 flex flex-wrap gap-3">
          {isAdmin && eventId && (
            <Link
              href={`/admin/events/${eventId}/attendance-report`}
              className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
            >
              出席レポートを見る
            </Link>
          )}
          <Link
            href={isUserOnly || role === UserRole.STAFF ? '/events' : '/admin/events'}
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
          >
            イベント一覧に戻る
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
