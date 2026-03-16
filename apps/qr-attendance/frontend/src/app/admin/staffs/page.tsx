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

interface Staff {
  email: string;
  name_kanji: string;
  name_kana: string;
  tel: string;
  org_id: string | null;
  remarks: string | null;
  role_flag: number; // 2=スタッフ, 3=管理者
  registration_date: string;
  total_attendance_records: number;
}

function StaffsPageContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadStaffs();
    }
  }, [isAuthenticated]);

  const loadStaffs = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const response = await apiClient.listStaffs({ 
        limit: 100,
        search: searchTerm || undefined,
      });
      setStaffs(response.staffs);
    } catch (err: any) {
      setError(err.message || 'スタッフの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (email: string) => {
    if (!confirm('このスタッフを利用者に変更しますか？\n（アカウントは残り、打刻記録も保持されます）')) {
      return;
    }

    try {
      setDeletingEmail(email);
      setError('');
      const result = await apiClient.deleteStaff(email);
      if (result.attendance_records_count) {
        setSuccess(`スタッフを利用者に変更しました（打刻記録: ${result.attendance_records_count}件）`);
      } else {
        setSuccess('スタッフを利用者に変更しました');
      }
      await loadStaffs();
    } catch (err: any) {
      setError(err.message || '利用者への変更に失敗しました');
    } finally {
      setDeletingEmail(null);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadStaffs();
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="認証情報を確認中..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">スタッフ管理</h1>
            <p className="text-lg text-gray-600">スタッフの登録・編集・削除ができます（招待メールは送りません）</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/"
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              ホームに戻る
            </Link>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              スタッフ登録
            </button>
          </div>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}
        {success && <SuccessAlert message={success} onDismiss={() => setSuccess('')} />}

        {/* 検索フォーム */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="名前、カナ、メールアドレスで検索..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              検索
            </button>
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  loadStaffs();
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                クリア
              </button>
            )}
          </form>
        </div>

        {loading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : staffs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">
              {searchTerm ? '検索結果が見つかりませんでした' : 'スタッフが登録されていません'}
            </p>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              最初のスタッフを登録
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      メールアドレス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      権限
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      氏名（漢字）
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      カナ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      電話番号
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      組織ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      打刻記録数
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {staffs.map((staff) => (
                    <tr key={staff.email} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {staff.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {staff.role_flag === 3 ? '管理者' : 'スタッフ'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {staff.name_kanji}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {staff.name_kana}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {staff.tel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {staff.org_id || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {staff.total_attendance_records}件
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setEditingStaff(staff)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(staff.email)}
                          disabled={deletingEmail === staff.email}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          {deletingEmail === staff.email ? '処理中...' : '利用者に変更'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* スタッフ登録モーダル */}
      {showInviteModal && (
        <StaffModal
          staff={null}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            loadStaffs();
          }}
        />
      )}

      {/* 編集モーダル */}
      {editingStaff && (
        <StaffModal
          staff={editingStaff}
          onClose={() => setEditingStaff(null)}
          onSuccess={() => {
            setEditingStaff(null);
            loadStaffs();
          }}
        />
      )}
    </main>
  );
}

function StaffModal({
  staff,
  onClose,
  onSuccess,
}: {
  staff: Staff | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    email: staff?.email || '',
    password: '',
    name_kanji: staff?.name_kanji || '',
    name_kana: staff?.name_kana || '',
    tel: staff?.tel || '',
    org_id: staff?.org_id || '',
    remarks: staff?.remarks || '',
    role_flag: staff?.role_flag ?? 2, // 2=スタッフ, 3=管理者
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (staff) {
        // 更新
        await apiClient.updateStaff(staff.email, {
          name_kanji: formData.name_kanji,
          name_kana: formData.name_kana,
          tel: formData.tel,
          org_id: formData.org_id || undefined,
          remarks: formData.remarks || undefined,
          password: formData.password || undefined,
          role_flag: formData.role_flag,
        });
      } else {
        // 新規登録
        await apiClient.inviteStaff({
          email: formData.email,
          password: formData.password || undefined,
          name_kanji: formData.name_kanji || undefined,
          name_kana: formData.name_kana || undefined,
          tel: formData.tel || undefined,
          org_id: formData.org_id || undefined,
          remarks: formData.remarks || undefined,
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || '保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">
          {staff ? 'スタッフ情報編集' : 'スタッフ登録'}
        </h2>

        {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!staff && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード（省略可、自動生成されます）
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  minLength={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          {staff && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  権限
                </label>
                <select
                  value={formData.role_flag}
                  onChange={(e) => setFormData({ ...formData, role_flag: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={2}>スタッフ</option>
                  <option value={3}>管理者</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード（変更する場合のみ）
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  minLength={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              氏名（漢字）
            </label>
            <input
              type="text"
              value={formData.name_kanji}
              onChange={(e) => setFormData({ ...formData, name_kanji: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カナ
            </label>
            <input
              type="text"
              value={formData.name_kana}
              onChange={(e) => setFormData({ ...formData, name_kana: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              電話番号
            </label>
            <input
              type="tel"
              value={formData.tel}
              onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              組織ID
            </label>
            <input
              type="text"
              value={formData.org_id}
              onChange={(e) => setFormData({ ...formData, org_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              備考
            </label>
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <LoadingButton
              type="submit"
              loading={isLoading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              {staff ? '更新' : '登録'}
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StaffsPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
      <StaffsPageContent />
    </RoleGuard>
  );
}
