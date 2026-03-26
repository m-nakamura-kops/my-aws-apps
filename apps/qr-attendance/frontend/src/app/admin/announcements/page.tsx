'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import SuccessAlert from '@/components/ui/SuccessAlert';
import LoadingButton from '@/components/ui/LoadingButton';
import TableSkeleton from '@/components/ui/TableSkeleton';
import EmergencyMobileBanner from '@/components/ui/EmergencyMobileBanner';

interface NewsItem {
  id: number;
  title: string;
  content: string;
  is_published: boolean;
  announcement_type: number;
  published_at: string;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
}

const ANNOUNCEMENT_TYPE_LABEL: Record<number, string> = {
  1: '通常',
  2: '重要（緊急）',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDatetimeLocal(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function AnnouncementModal({
  item,
  onClose,
  onSuccess,
}: {
  item: NewsItem | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_published: true,
    announcement_type: 1 as number,
    published_at: '',
    expired_at: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title,
        content: item.content,
        is_published: item.is_published,
        announcement_type: item.announcement_type,
        published_at: toDatetimeLocal(item.published_at),
        expired_at: toDatetimeLocal(item.expired_at),
      });
    } else {
      const now = new Date();
      setFormData({
        title: '',
        content: '',
        is_published: true,
        announcement_type: 1,
        published_at: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        expired_at: '',
      });
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        is_published: formData.is_published,
        announcement_type: formData.announcement_type,
        published_at: new Date(formData.published_at).toISOString(),
        expired_at: formData.expired_at ? new Date(formData.expired_at).toISOString() : null,
      };
      if (item) {
        await apiClient.updateNews(item.id, payload);
      } else {
        await apiClient.createNews(payload);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white text-slate-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-slate-900 p-6 pb-2">{item ? 'お知らせ編集' : '新規お知らせ'}</h2>
        {error && (
          <div className="mx-6 mt-2">
            <ErrorAlert message={error} onDismiss={() => setError('')} />
          </div>
        )}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">タイトル <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">本文 <span className="text-red-500">*</span></label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">種別</label>
            <select
              value={formData.announcement_type}
              onChange={(e) => setFormData({ ...formData, announcement_type: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
            >
              <option value={1}>通常</option>
              <option value={2}>重要（緊急）</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_published"
              checked={formData.is_published}
              onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="is_published" className="text-sm font-medium text-gray-700">公開する</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">掲載開始日時 <span className="text-red-500">*</span></label>
            <input
              type="datetime-local"
              value={formData.published_at}
              onChange={(e) => setFormData({ ...formData, published_at: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">掲載終了日時（任意・空で無期限）</label>
            <input
              type="datetime-local"
              value={formData.expired_at}
              onChange={(e) => setFormData({ ...formData, expired_at: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
              {loading ? '保存中...' : '保存'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AnnouncementsPageContent() {
  const router = useRouter();
  const [list, setList] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pagination, setPagination] = useState({ total: 0, limit: 100, offset: 0, hasMore: false });
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.getAdminNews({ limit: 100, offset: 0 });
      setList(res.news);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message || 'お知らせの取得に失敗しました');
      setList([]);
      setPagination({ total: 0, limit: 100, offset: 0, hasMore: false });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('このお知らせを削除しますか？')) return;
    try {
      setDeletingId(id);
      setError('');
      await apiClient.deleteNews(id);
      setSuccess('お知らせを削除しました');
      await loadList();
    } catch (err: any) {
      setError(err.message || '削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setShowModal(true);
  };
  const openEdit = (item: NewsItem) => {
    setEditingItem(item);
    setShowModal(true);
  };

  if (loading && list.length === 0) {
    return (
      <main className="min-h-screen p-8 bg-gray-50 text-slate-900">
        <EmergencyMobileBanner />
        <div className="max-w-6xl mx-auto">
          <TableSkeleton rows={5} columns={6} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50 text-slate-900">
      <EmergencyMobileBanner />
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-slate-900">お知らせ管理</h1>
            <p className="text-lg text-slate-600">重要なお知らせの作成・編集・削除</p>
          </div>
          <div className="flex gap-3">
            <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              新規作成
            </button>
            <Link href="/home" className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">ホームに戻る</Link>
          </div>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError('')} onRetry={loadList} className="mb-4" />}
        {success && <SuccessAlert message={success} onDismiss={() => setSuccess('')} className="mb-4" />}

        {list.length === 0 ? (
          <div className="bg-white text-slate-900 rounded-lg shadow p-12 text-center">
            <p className="text-slate-600">お知らせはまだありません</p>
            <button onClick={openCreate} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">新規作成</button>
          </div>
        ) : (
          <div className="bg-white text-slate-900 shadow rounded-lg overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">タイトル</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">種別</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">公開</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">掲載開始</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">掲載終了</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {list.map((n) => (
                    <tr key={n.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{n.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{ANNOUNCEMENT_TYPE_LABEL[n.announcement_type] ?? '通常'}</td>
                      <td className="px-6 py-4 text-sm">{n.is_published ? '公開' : '非公開'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(n.published_at)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(n.expired_at)}</td>
                      <td className="px-6 py-4 text-right text-sm">
                        <button onClick={() => openEdit(n)} className="text-indigo-600 hover:text-indigo-900 mr-3">編集</button>
                        <button onClick={() => handleDelete(n.id)} disabled={deletingId === n.id} className="text-red-600 hover:text-red-900 disabled:opacity-50">削除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-gray-200">
              {list.map((n) => (
                <div key={n.id} className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-medium text-gray-900">{n.title}</span>
                      <span className="ml-2 text-xs text-gray-500">{ANNOUNCEMENT_TYPE_LABEL[n.announcement_type] ?? '通常'}</span>
                      <span className="ml-2 text-xs">{n.is_published ? '公開' : '非公開'}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(n)} className="px-3 py-1 text-sm bg-indigo-100 text-indigo-800 rounded">編集</button>
                      <button onClick={() => handleDelete(n.id)} disabled={deletingId === n.id} className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded">削除</button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{formatDate(n.published_at)} ～ {formatDate(n.expired_at)}</div>
                </div>
              ))}
            </div>
            {pagination.total > 0 && (
              <div className="bg-gray-50 px-6 py-3 border-t text-sm text-gray-600">
                {pagination.offset + 1} ～ {Math.min(pagination.offset + list.length, pagination.total)} / {pagination.total} 件
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <AnnouncementModal
          item={editingItem}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSuccess={() => { setShowModal(false); setEditingItem(null); loadList(); }}
        />
      )}
    </main>
  );
}

export default function AnnouncementsPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.STAFF]}>
      <AnnouncementsPageContent />
    </RoleGuard>
  );
}
