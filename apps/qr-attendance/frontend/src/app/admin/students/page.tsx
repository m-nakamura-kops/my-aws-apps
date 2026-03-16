'use client';

import { useState, useEffect, useRef } from 'react';
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

interface Student {
  email: string;
  name_kanji: string;
  name_kana: string;
  tel: string;
  org_id: string | null;
  remarks: string | null;
  registration_date: string;
  last_attendance_date: string | null;
}

function StudentsPageContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; totalRows: number; errors: Array<{ row: number; email?: string; message: string }> } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadStudents();
    }
  }, [isAuthenticated]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const response = await apiClient.listStudents({ 
        limit: 100,
        search: searchTerm || undefined,
      });
      setStudents(response.students);
    } catch (err: any) {
      setError(err.message || '生徒の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (email: string) => {
    if (!confirm('この生徒を削除しますか？')) {
      return;
    }

    try {
      setDeletingEmail(email);
      setError('');
      await apiClient.deleteStudent(email);
      setSuccess('生徒を削除しました');
      await loadStudents();
    } catch (err: any) {
      setError(err.message || '生徒の削除に失敗しました');
    } finally {
      setDeletingEmail(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
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
    loadStudents();
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSuccess('');
    setImportResult(null);
    setImporting(true);
    try {
      const csv = await file.text();
      const result = await apiClient.importStudents(csv);
      setImportResult(result);
      if (result.imported > 0) {
        setSuccess(`${result.imported}件を登録しました`);
        await loadStudents();
      }
      if (result.errors.length > 0 && result.imported === 0) {
        setError(`${result.errors.length}件のエラーがあります`);
      }
    } catch (err: any) {
      setError(err.message || 'CSVのインポートに失敗しました');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const openCsvInput = () => csvInputRef.current?.click();

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
            <h1 className="text-4xl font-bold mb-2">生徒名簿管理</h1>
            <p className="text-lg text-gray-600">生徒の登録・編集・削除ができます</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/"
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              ホームに戻る
            </Link>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvImport}
              disabled={importing}
            />
            <button
              type="button"
              onClick={openCsvInput}
              disabled={importing}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {importing ? 'インポート中...' : 'CSVで一括登録'}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              新規生徒登録
            </button>
          </div>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}
        {success && <SuccessAlert message={success} onDismiss={() => setSuccess('')} />}

        {importResult && (
          <div className="bg-white rounded-lg shadow p-4 mb-6 border border-gray-200">
            <h3 className="font-medium text-gray-900 mb-2">CSVインポート結果</h3>
            <p className="text-sm text-gray-600 mb-2">
              登録: {importResult.imported}件 / 対象行: {importResult.totalRows}行
              {importResult.errors.length > 0 && ` / エラー: ${importResult.errors.length}件`}
            </p>
            {importResult.errors.length > 0 && (
              <ul className="text-sm text-amber-700 max-h-40 overflow-y-auto list-disc list-inside">
                {importResult.errors.slice(0, 20).map((err, i) => (
                  <li key={i}>行{err.row}: {err.email ? `${err.email} - ` : ''}{err.message}</li>
                ))}
                {importResult.errors.length > 20 && (
                  <li>...他 {importResult.errors.length - 20}件</li>
                )}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setImportResult(null)}
              className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
            >
              閉じる
            </button>
          </div>
        )}

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
                  loadStudents();
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
        ) : students.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">
              {searchTerm ? '検索結果が見つかりませんでした' : '生徒が登録されていません'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              最初の生徒を登録
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
                      最終打刻日
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.email} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.name_kanji}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.name_kana}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.tel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.org_id || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(student.last_attendance_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setEditingStudent(student)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(student.email)}
                          disabled={deletingEmail === student.email}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          {deletingEmail === student.email ? '削除中...' : '削除'}
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

      {/* 作成モーダル */}
      {showCreateModal && (
        <StudentModal
          student={null}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadStudents();
          }}
        />
      )}

      {/* 編集モーダル */}
      {editingStudent && (
        <StudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSuccess={() => {
            setEditingStudent(null);
            loadStudents();
          }}
        />
      )}
    </main>
  );
}

function StudentModal({
  student,
  onClose,
  onSuccess,
}: {
  student: Student | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    email: student?.email || '',
    password: '',
    name_kanji: student?.name_kanji || '',
    name_kana: student?.name_kana || '',
    tel: student?.tel || '',
    org_id: student?.org_id || '',
    remarks: student?.remarks || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (student) {
        // 更新
        await apiClient.updateStudent(student.email, {
          name_kanji: formData.name_kanji,
          name_kana: formData.name_kana,
          tel: formData.tel,
          org_id: formData.org_id || undefined,
          remarks: formData.remarks || undefined,
          password: formData.password || undefined,
        });
      } else {
        // 作成
        if (!formData.password) {
          setError('パスワードは必須です');
          setIsLoading(false);
          return;
        }
        await apiClient.createStudent({
          email: formData.email,
          password: formData.password,
          name_kanji: formData.name_kanji,
          name_kana: formData.name_kana,
          tel: formData.tel,
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
          {student ? '生徒情報編集' : '新規生徒登録'}
        </h2>

        {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!student && (
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
                  パスワード <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!student}
                  minLength={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={student ? '変更する場合のみ入力' : ''}
                />
              </div>
            </>
          )}

          {student && (
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
          )}

          {student && (
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
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              氏名（漢字） <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name_kanji}
              onChange={(e) => setFormData({ ...formData, name_kanji: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カナ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name_kana}
              onChange={(e) => setFormData({ ...formData, name_kana: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              電話番号 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.tel}
              onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
              required
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
              {student ? '更新' : '登録'}
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
      <StudentsPageContent />
    </RoleGuard>
  );
}
