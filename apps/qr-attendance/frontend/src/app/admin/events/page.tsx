'use client';

/**
 * No.6.4.9 管理者：イベント管理一覧 (/admin/events)
 * No.6.4.10 管理者：イベント編集（モーダル）
 * 新規作成・一覧・編集・削除・QR・参加者・レポートへのハブ。入力バリデーション・削除確認・成功トーストあり。
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import SuccessAlert from '@/components/ui/SuccessAlert';
import LoadingButton from '@/components/ui/LoadingButton';
import TableSkeleton from '@/components/ui/TableSkeleton';

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

function EventsPageContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [qrCodeEvent, setQrCodeEvent] = useState<Event | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<number | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const response = await apiClient.listEvents({ limit: 100 });
      setEvents(response.events);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'イベントの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (event: Event) => {
    if (!confirm(`イベント「${event.event_name}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    try {
      setDeletingEventId(event.event_id);
      setError('');
      await apiClient.deleteEvent(event.event_id);
      setSuccess('削除が完了しました');
      await loadEvents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'イベントの削除に失敗しました');
    } finally {
      setDeletingEventId(null);
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
            <h1 className="text-4xl font-bold mb-2">イベント管理</h1>
            <p className="text-lg text-gray-600">イベントの作成・編集・削除ができます</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/home"
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              ホームに戻る
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              新規イベント作成
            </button>
          </div>
        </div>

        {error && (
          <ErrorAlert message={error} onDismiss={() => setError('')} className="mb-4" />
        )}

        {success && (
          <SuccessAlert message={success} onDismiss={() => setSuccess('')} className="mb-4" />
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">読み込み中...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">イベントがありません</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              最初のイベントを作成
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      イベント名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      開催日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      場所
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      定員
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {events.map((event) => (
                    <tr key={event.event_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/events/${event.event_id}`}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          {event.event_name}
                        </Link>
                        {event.summary && (
                          <div className="text-sm text-gray-500 mt-1">
                            {event.summary.length > 50
                              ? `${event.summary.substring(0, 50)}...`
                              : event.summary}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(event.event_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {event.location || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {event.capacity ? `${event.capacity}人` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2 sm:gap-3 flex-wrap">
                          <button
                            onClick={() => setEditingEvent(event)}
                            className="min-h-[44px] px-3 py-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded border border-indigo-200 text-sm"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => setQrCodeEvent(event)}
                            className="min-h-[44px] px-3 py-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded border border-green-200 text-sm"
                          >
                            QRコード
                          </button>
                          <Link
                            href={`/admin/events/${event.event_id}/participants`}
                            className="min-h-[44px] inline-flex items-center px-3 py-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded border border-blue-200 text-sm"
                          >
                            参加者
                          </Link>
                          <Link
                            href={`/admin/events/${event.event_id}/attendance-report`}
                            className="min-h-[44px] inline-flex items-center px-3 py-2 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded border border-purple-200 text-sm"
                          >
                            レポート
                          </Link>
                          <LoadingButton
                            onClick={() => handleDelete(event)}
                            loading={deletingEventId === event.event_id}
                            disabled={deletingEventId !== null}
                            variant="danger"
                            className="min-h-[44px] px-3 py-2 text-sm"
                          >
                            削除
                          </LoadingButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showCreateModal && (
          <EventCreateModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              setSuccess('作成が完了しました');
              loadEvents();
            }}
          />
        )}

        {editingEvent && (
          <EventEditModal
            event={editingEvent}
            onClose={() => setEditingEvent(null)}
            onSuccess={() => {
              setEditingEvent(null);
              setSuccess('更新が完了しました');
              loadEvents();
            }}
          />
        )}

        {qrCodeEvent && (
          <QRCodeModal
            event={qrCodeEvent}
            onClose={() => setQrCodeEvent(null)}
          />
        )}
      </div>
    </main>
  );
}

export default function EventsPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
      <EventsPageContent />
    </RoleGuard>
  );
}

function EventEditModal({
  event,
  onClose,
  onSuccess,
}: {
  event: Event;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    event_name: event.event_name,
    event_date: event.event_date.substring(0, 16), // datetime-local形式に変換
    location: event.location || '',
    capacity: event.capacity?.toString() || '',
    summary: event.summary || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const name = formData.event_name.trim();
    if (!name) {
      setError('イベント名を入力してください');
      return;
    }
    if (!formData.event_date) {
      setError('開催日時を入力してください');
      return;
    }
    if (formData.capacity.trim() !== '') {
      const cap = parseInt(formData.capacity, 10);
      if (Number.isNaN(cap) || cap < 1 || !Number.isInteger(cap)) {
        setError('定員は1以上の整数で入力してください');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await apiClient.updateEvent(event.event_id, {
        event_name: name,
        event_date: formData.event_date,
        location: formData.location.trim() || undefined,
        capacity: formData.capacity.trim() ? parseInt(formData.capacity, 10) : undefined,
        summary: formData.summary.trim() || undefined,
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'イベントの更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">イベント編集</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {error && (
            <ErrorAlert message={error} onDismiss={() => setError('')} className="mb-4" />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                イベント名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.event_name}
                onChange={(e) =>
                  setFormData({ ...formData, event_name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                開催日時 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={formData.event_date}
                onChange={(e) =>
                  setFormData({ ...formData, event_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                場所
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                定員
              </label>
              <input
                type="number"
                min="1"
                value={formData.capacity}
                onChange={(e) =>
                  setFormData({ ...formData, capacity: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                概要
              </label>
              <textarea
                rows={4}
                value={formData.summary}
                onChange={(e) =>
                  setFormData({ ...formData, summary: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={isSubmitting}
              >
                キャンセル
              </button>
              <LoadingButton
                type="submit"
                loading={isSubmitting}
                variant="primary"
              >
                更新
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function EventCreateModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    event_name: '',
    event_date: '',
    location: '',
    capacity: '',
    summary: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const name = formData.event_name.trim();
    if (!name) {
      setError('イベント名を入力してください');
      return;
    }
    if (!formData.event_date) {
      setError('開催日時を入力してください');
      return;
    }
    const eventDate = new Date(formData.event_date);
    if (eventDate.getTime() <= Date.now()) {
      setError('開催日時は未来の日時を指定してください');
      return;
    }
    if (formData.capacity.trim() !== '') {
      const cap = parseInt(formData.capacity, 10);
      if (Number.isNaN(cap) || cap < 1 || !Number.isInteger(cap)) {
        setError('定員は1以上の整数で入力してください');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await apiClient.createEvent({
        event_name: name,
        event_date: formData.event_date,
        location: formData.location.trim() || undefined,
        capacity: formData.capacity.trim() ? parseInt(formData.capacity, 10) : undefined,
        summary: formData.summary || undefined,
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'イベントの作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">新規イベント作成</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {error && (
            <ErrorAlert message={error} onDismiss={() => setError('')} className="mb-4" />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                イベント名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.event_name}
                onChange={(e) =>
                  setFormData({ ...formData, event_name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                開催日時 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={formData.event_date}
                onChange={(e) =>
                  setFormData({ ...formData, event_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                場所
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                定員
              </label>
              <input
                type="number"
                min="1"
                value={formData.capacity}
                onChange={(e) =>
                  setFormData({ ...formData, capacity: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                概要
              </label>
              <textarea
                rows={4}
                value={formData.summary}
                onChange={(e) =>
                  setFormData({ ...formData, summary: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={isSubmitting}
              >
                キャンセル
              </button>
              <LoadingButton
                type="submit"
                loading={isSubmitting}
                variant="primary"
              >
                作成
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function QRCodeModal({
  event,
  onClose,
}: {
  event: Event;
  onClose: () => void;
}) {
  const [qrData, setQrData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadQRCode();
  }, [event.event_id]);

  const loadQRCode = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.generateQRCode(event.event_id);
      setQrData(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'QRコードの生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">QRコード</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {error && (
            <ErrorAlert 
              message={error} 
              onRetry={loadQRCode}
              onDismiss={() => setError('')}
              className="mb-4"
            />
          )}

          {loading ? (
            <LoadingSpinner text="QRコード生成中..." />
          ) : qrData ? (
            <div className="text-center">
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">{event.event_name}</h3>
                <p className="text-sm text-gray-600">
                  有効期限: {new Date(qrData.expires_at).toLocaleString('ja-JP')}
                </p>
              </div>
              <div className="flex justify-center mb-4 p-4 bg-gray-50 rounded-lg">
                <QRCodeSVG
                  value={qrData.qr_code_url}
                  size={256}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-sm text-gray-600 mb-4">
                このQRコードをスキャンして打刻を行います
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(qrData.qr_code_url);
                  alert('QRコードURLをクリップボードにコピーしました');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
              >
                URLをコピー
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
