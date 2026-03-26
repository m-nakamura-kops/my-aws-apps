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
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [demotingEmail, setDemotingEmail] = useState<string | null>(null);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

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

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!t) return;
    try {
      const payload = JSON.parse(atob(t));
      if (payload.email) setCurrentUserEmail(payload.email);
    } catch {}
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

  const handleDemoteToUser = async (email: string) => {
    if (currentUserEmail && currentUserEmail.toLowerCase() === email.toLowerCase()) {
      setError('自分自身の権限は変更できません');
      return;
    }
    if (!confirm('スタッフ権限を解除し、利用者へ戻しますか？')) {
      return;
    }

    try {
      setDemotingEmail(email);
      setError('');
      await apiClient.updateStaff(email, { role_flag: 1 });
      setSuccess('スタッフ権限を解除し、利用者に変更しました');
      await loadStaffs();
    } catch (err: any) {
      setError(err.message || '利用者への変更に失敗しました');
    } finally {
      setDemotingEmail(null);
    }
  };

  const handlePermanentDelete = async (email: string) => {
    if (currentUserEmail && currentUserEmail.toLowerCase() === email.toLowerCase()) {
      setError('自分自身のアカウントは削除できません');
      return;
    }
    if (!confirm('アカウントを削除しますか？この操作は取り消せません')) {
      return;
    }

    try {
      setDeletingEmail(email);
      setError('');
      const result = await apiClient.deleteStaff(email);
      let msg = result.message || 'アカウントを削除しました';
      if (result.cognito_error) {
        msg += `（Cognito: ${result.cognito_error}）`;
      } else if (result.cognito_deleted) {
        msg += '（Cognito ユーザーも削除しました）';
      }
      setSuccess(msg);
      await loadStaffs();
    } catch (err: any) {
      setError(err.message || 'アカウントの削除に失敗しました');
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
      <EmergencyMobileBanner />
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">スタッフ管理</h1>
            <p className="text-lg text-gray-600">
              スタッフの登録・編集、「利用者へ変更」（権限解除）、「削除」（DB／Cognito からの物理削除）ができます。削除・権限変更は管理者のみ操作できます（招待メールは送りません）
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/home"
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
            {/* PC: テーブル（≥768px） */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">メールアドレス</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">権限</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名（漢字）</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">カナ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">電話番号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">組織ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">打刻記録数</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {staffs.map((staff) => {
                    const isSelf = currentUserEmail && currentUserEmail.toLowerCase() === staff.email.toLowerCase();
                    return (
                      <tr key={staff.email} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{staff.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.role_flag === 3 ? '管理者' : 'スタッフ'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.name_kanji}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.name_kana}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.tel}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.org_id || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.total_attendance_records}件</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {isSelf ? (
                            <span className="text-gray-500 text-xs">自分自身の権限変更・削除はできません</span>
                          ) : !isAdmin ? (
                            <span className="text-gray-400 text-xs">管理者のみ操作できます</span>
                          ) : (
                            <span className="inline-flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingStaff(staff)}
                                disabled={demotingEmail === staff.email || deletingEmail === staff.email}
                                className="text-indigo-600 hover:text-indigo-900 min-h-[44px] px-1 disabled:opacity-50"
                              >
                                編集
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDemoteToUser(staff.email)}
                                disabled={demotingEmail === staff.email || deletingEmail === staff.email}
                                className="min-h-[44px] px-3 py-1 rounded border-2 border-amber-500 text-amber-800 bg-white hover:bg-amber-50 disabled:opacity-50"
                              >
                                {demotingEmail === staff.email ? '処理中...' : '利用者へ変更'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePermanentDelete(staff.email)}
                                disabled={demotingEmail === staff.email || deletingEmail === staff.email}
                                className="min-h-[44px] px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {deletingEmail === staff.email ? '処理中...' : '削除'}
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* スマホ: カード（<768px） */}
            <div className="md:hidden divide-y divide-gray-200">
              {staffs.map((staff) => {
                const isSelf = currentUserEmail && currentUserEmail.toLowerCase() === staff.email.toLowerCase();
                return (
                  <div key={staff.email} className="p-4 min-h-[44px]">
                    <div className="font-medium text-gray-900">{staff.name_kanji} {staff.name_kana && <span className="text-gray-500 text-sm">({staff.name_kana})</span>}</div>
                    <div className="text-sm text-gray-500">{staff.email}</div>
                    <div className="text-sm text-gray-600 mt-1">権限: {staff.role_flag === 3 ? '管理者' : 'スタッフ'} · 打刻: {staff.total_attendance_records}件</div>
                    {isSelf ? (
                      <p className="text-xs text-gray-500 mt-2">自分自身の権限変更・削除はできません</p>
                    ) : !isAdmin ? (
                      <p className="text-xs text-gray-400 mt-2">管理者のみ操作できます</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setEditingStaff(staff)}
                          disabled={demotingEmail === staff.email || deletingEmail === staff.email}
                          className="px-3 py-2 text-indigo-600 border border-indigo-600 rounded min-h-[44px] disabled:opacity-50"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDemoteToUser(staff.email)}
                          disabled={demotingEmail === staff.email || deletingEmail === staff.email}
                          className="px-3 py-2 rounded min-h-[44px] border-2 border-amber-500 text-amber-800 bg-white disabled:opacity-50"
                        >
                          {demotingEmail === staff.email ? '処理中...' : '利用者へ変更'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePermanentDelete(staff.email)}
                          disabled={demotingEmail === staff.email || deletingEmail === staff.email}
                          className="px-3 py-2 rounded min-h-[44px] bg-red-600 text-white disabled:opacity-50"
                        >
                          {deletingEmail === staff.email ? '処理中...' : '削除'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
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
          currentUserEmail={currentUserEmail}
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
  currentUserEmail,
  onClose,
  onSuccess,
}: {
  staff: Staff | null;
  currentUserEmail?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isSelf = staff && currentUserEmail && currentUserEmail.toLowerCase() === staff.email.toLowerCase();
  const [formData, setFormData] = useState({
    email: staff?.email || '',
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
          role_flag: formData.role_flag,
        });
      } else {
        // 新規: Cognito 招待メール（仮パスワード）。管理者はパスワードを設定しない。
        await apiClient.inviteStaff({
          email: formData.email,
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
              <p className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                登録後、入力したメール宛に Cognito から招待メール（仮パスワード）が届きます。本人が初回ログイン時にパスワードを設定してください。
              </p>
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
                {isSelf ? (
                  <p className="text-sm text-gray-500 py-2">自分自身の権限は変更できません</p>
                ) : (
                  <select
                    value={formData.role_flag}
                    onChange={(e) => setFormData({ ...formData, role_flag: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={2}>スタッフ</option>
                    <option value={3}>管理者</option>
                  </select>
                )}
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
