'use client';

/**
 * 手動打刻画面（QRが使えない場合の代替・レスキュー）
 * FE_STAFF_MANUAL_IMPLEMENTATION_PLAN.md に準拠。
 * 入口: /staff/scan の「QRが読めない場合はこちら」。完了後は必ず「QRスキャンに戻る」を強調。
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { UserRole } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import ErrorAlert from '@/components/ui/ErrorAlert';
import SuccessAlert from '@/components/ui/SuccessAlert';
import LoadingButton from '@/components/ui/LoadingButton';

type EventItem = { event_id: number; event_name: string; event_date: string };
type StudentItem = { user_id: string; name_kanji: string; name_kana: string; email: string };

function StaffManualPageContent() {
  const { isAuthenticated, isLoading: authLoading, isStaff, isAdmin } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<number | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StudentItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [punching, setPunching] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<{ in_time: string | null; out_time: string | null } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!authLoading && !isStaff) {
      router.replace('/home');
    }
  }, [isAuthenticated, authLoading, isStaff, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingEvents(true);
    apiClient
      .listEventsForStaff({ limit: 100 })
      .then((res) => setEvents(res.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [isAuthenticated]);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setError('2文字以上入力してください');
      return;
    }
    setError('');
    setSearching(true);
    setSearchResults([]);
    setSelectedStudent(null);
    try {
      const res = await apiClient.searchStudentsForManual(q);
      setSearchResults(res.users || []);
      if (!res.users?.length) {
        setError('該当する生徒がいません。名簿にない場合は管理者にご依頼ください。');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '検索に失敗しました';
      setError(msg);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    // selectedEventId は number | ''。数値 0 はイベントIDとして不自然だが、'' との比較で型が明確になる
    if (selectedEventId === '' || !selectedStudent) {
      setAttendanceStatus(null);
      return;
    }
    setLoadingStatus(true);
    setAttendanceStatus(null);
    apiClient
      .getEventParticipants(Number(selectedEventId), { limit: 500 })
      .then((res) => {
        const p = res.participants?.find((x: { email: string }) => x.email === selectedStudent.email);
        setAttendanceStatus(p ? { in_time: p.in_time ?? null, out_time: p.out_time ?? null } : null);
      })
      .catch(() => setAttendanceStatus(null))
      .finally(() => setLoadingStatus(false));
  }, [selectedEventId, selectedStudent?.email]);

  const handlePunch = useCallback(
    async (action: 'entry' | 'exit') => {
      if (selectedEventId === '' || !selectedStudent) {
        setError('イベントと生徒を選択してください');
        return;
      }
      setError('');
      setPunching(true);
      try {
        await apiClient.manualPunchAttendance({
          event_id: Number(selectedEventId),
          email: selectedStudent.email,
          action,
        });
        const label = action === 'entry' ? '入室' : '退出';
        setSuccessMessage(`${selectedStudent.name_kanji || selectedStudent.email} さんの${label}打刻を記録しました。`);
        setAttendanceStatus((prev) =>
          action === 'entry' ? { in_time: new Date().toISOString(), out_time: prev?.out_time ?? null } : { in_time: prev?.in_time ?? null, out_time: new Date().toISOString() }
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '打刻に失敗しました';
        const status = (err as { status?: number })?.status;
        if (status === 409 || msg.includes('既に') || msg.includes('済み') || /already checked/i.test(msg)) {
          setError(msg);
        } else {
          setError(msg);
        }
      } finally {
        setPunching(false);
      }
    },
    [selectedEventId, selectedStudent]
  );

  const clearSuccess = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }
  if (!isStaff) return null;

  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー: タイトル + QRスキャンに戻る（常時表示） */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">手動打刻</h1>
            <p className="text-gray-600 text-sm">QRが使えない場合の代替です</p>
          </div>
          <Link
            href="/staff/scan"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
          >
            QRスキャン画面に戻る
          </Link>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError('')} className="mb-4" />}
        {successMessage && (
          <SuccessAlert message={successMessage} onDismiss={clearSuccess} className="mb-4" />
        )}

        {/* 完了後の強調ブロック: QRスキャンに戻るを最優先表示 */}
        {successMessage && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 border-2 border-indigo-200">
            <p className="text-gray-800 font-medium mb-4">{successMessage}</p>
            <Link
              href="/staff/scan"
              className="inline-block w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-semibold text-center"
            >
              QRスキャン画面に戻る
            </Link>
            <p className="text-sm text-gray-500 mt-3">もう1件手動で打刻する場合は、下のフォームで再度検索してください。</p>
          </div>
        )}

        {/* 管理者のみ: 新規生徒登録へのリンク */}
        {isAdmin && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">名前で見つからない場合</p>
            <Link
              href="/admin/students"
              className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
            >
              新規生徒登録（生徒名簿管理）
            </Link>
          </div>
        )}

        {/* イベント選択 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">イベントを選択</label>
          {loadingEvents ? (
            <p className="text-gray-500 text-sm">読み込み中...</p>
          ) : (
            <select
              value={selectedEventId === '' ? '' : selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">-- 選択してください --</option>
              {events.map((ev) => (
                <option key={ev.event_id} value={ev.event_id}>
                  {ev.event_name}（ID: {ev.event_id}）
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 生徒検索 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">生徒を検索（2文字以上）</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="名前（漢字・ふりがな）"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching || searchQuery.trim().length < 2}
              className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searching ? '検索中...' : '検索'}
            </button>
          </div>
        </div>

        {/* 検索結果一覧 */}
        {searchResults.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="text-sm font-medium text-gray-700 mb-2">検索結果（クリックで選択）</h2>
            <ul className="divide-y divide-gray-200">
              {searchResults.map((s) => (
                <li key={s.email}>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(s)}
                    className={`w-full text-left px-3 py-2 rounded ${
                      selectedStudent?.email === s.email
                        ? 'bg-indigo-100 border border-indigo-300'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-medium">{s.name_kanji}</span>
                    <span className="text-gray-500 text-sm ml-2">{s.name_kana}</span>
                    <span className="text-gray-400 text-xs block">{s.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 打刻実行：現在のステータス表示と入室・退出ボタン */}
        {selectedStudent && selectedEventId !== '' && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              {selectedStudent.name_kanji} さんを選択中（イベントID: {selectedEventId}）
            </p>
            {loadingStatus ? (
              <p className="text-sm text-gray-500 mb-3">打刻状況を取得中...</p>
            ) : attendanceStatus ? (
              <div className="text-sm text-gray-600 mb-3 p-3 bg-gray-50 rounded border border-gray-200">
                <span className="font-medium">現在の状態: </span>
                {attendanceStatus.in_time && attendanceStatus.out_time
                  ? '入室済み・退出済み'
                  : attendanceStatus.in_time
                    ? '入室済み（退出未記録）'
                    : attendanceStatus.out_time
                      ? '退出のみ記録済み'
                      : '未打刻'}
                {attendanceStatus.in_time && (
                  <span className="block mt-1 text-gray-500">入室: {new Date(attendanceStatus.in_time).toLocaleString('ja-JP')}</span>
                )}
                {attendanceStatus.out_time && (
                  <span className="block text-gray-500">退出: {new Date(attendanceStatus.out_time).toLocaleString('ja-JP')}</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-3">未打刻</p>
            )}
            <div className="flex gap-3 flex-wrap">
              <LoadingButton
                type="button"
                loading={punching}
                variant="primary"
                onClick={() => handlePunch('entry')}
                className="min-h-[44px] flex-1 min-w-[120px]"
              >
                入室打刻
              </LoadingButton>
              <LoadingButton
                type="button"
                loading={punching}
                variant="secondary"
                onClick={() => handlePunch('exit')}
                className="min-h-[44px] flex-1 min-w-[120px] border border-gray-400 text-gray-800 hover:bg-gray-100"
              >
                退出打刻
              </LoadingButton>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function StaffManualPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.STAFF, UserRole.ADMIN]} redirectTo="/home">
      <StaffManualPageContent />
    </RoleGuard>
  );
}
