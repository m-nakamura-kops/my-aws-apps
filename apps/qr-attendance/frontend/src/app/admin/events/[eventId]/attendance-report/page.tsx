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

interface AttendanceLog {
  log_id: number;
  email: string;
  user_name: string;
  in_time: string;
  out_time: string | null;
  stay_minutes: number | null;
  staff_email: string;
  staff_name: string;
}

function EventAttendanceReportPageContent() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.eventId ? parseInt(params.eventId as string, 10) : null;

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (eventId) {
      loadReport();
    }
  }, [eventId]);

  const loadReport = async () => {
    if (!eventId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.getEventAttendanceReport(eventId);
      setReport(response);
    } catch (err: any) {
      console.error('Failed to load attendance report:', err);
      setError(err.message || '出席レポートの取得に失敗しました');
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

  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}時間${mins}分`;
    }
    return `${mins}分`;
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="レポートを読み込み中..." />;
  }

  if (error && !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <ErrorAlert 
            message={error} 
            onRetry={loadReport}
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

  if (!report) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href="/admin/events"
            className="text-indigo-600 hover:text-indigo-800 mb-4 inline-block"
          >
            ← イベント一覧に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">出席レポート</h1>
          <p className="text-lg text-gray-600 mt-2">{report.event_name}</p>
          <p className="text-sm text-gray-500">
            {new Date(report.event_date).toLocaleString('ja-JP')}
            {report.location && ` @ ${report.location}`}
          </p>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <ErrorAlert 
            message={error} 
            onRetry={loadReport}
            onDismiss={() => setError(null)}
            className="mb-4"
          />
        )}

        {/* サマリー */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">サマリー</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">参加申込数</div>
              <div className="text-2xl font-bold text-blue-600">{report.summary.total_registrations}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">出席者数</div>
              <div className="text-2xl font-bold text-green-600">{report.summary.total_attendees}</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">欠席者数</div>
              <div className="text-2xl font-bold text-yellow-600">{report.summary.no_show_count}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">出席率</div>
              <div className="text-2xl font-bold text-purple-600">{report.summary.attendance_rate}%</div>
            </div>
          </div>
        </div>

        {/* 統計情報 */}
        {report.statistics.stay_duration && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">滞在時間統計</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600">平均滞在時間</div>
                <div className="text-lg font-semibold">
                  {formatDuration(report.statistics.stay_duration.avg_minutes)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">最短滞在時間</div>
                <div className="text-lg font-semibold">
                  {formatDuration(report.statistics.stay_duration.min_minutes)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">最長滞在時間</div>
                <div className="text-lg font-semibold">
                  {formatDuration(report.statistics.stay_duration.max_minutes)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 時間帯別分布 */}
        {report.statistics.time_slot_distribution.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">時間帯別入室数</h2>
            <div className="space-y-2">
              {report.statistics.time_slot_distribution.map((stat: any) => (
                <div key={stat.time_slot} className="flex items-center">
                  <div className="w-20 text-sm text-gray-600">{stat.time_slot}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                    <div
                      className="bg-indigo-600 h-6 rounded-full flex items-center justify-end pr-2"
                      style={{
                        width: `${(stat.count / report.summary.total_attendees) * 100}%`,
                      }}
                    >
                      <span className="text-xs text-white font-medium">{stat.count}人</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 出席履歴 */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">出席履歴</h2>
          </div>
          {report.attendance_logs.length === 0 ? (
            <div className="p-12 text-center text-gray-600">
              出席履歴がありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ユーザー名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      メールアドレス
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
                  {report.attendance_logs.map((log: AttendanceLog, index: number) => (
                    <tr key={`${log.log_id}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.user_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.in_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.out_time ? formatDate(log.out_time) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDuration(log.stay_minutes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{log.staff_name}</div>
                        <div className="text-xs text-gray-400">{log.staff_email}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* アクションボタン */}
        <div className="mt-6 flex gap-4">
          <Link
            href={`/admin/events/${eventId}/participants`}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            参加者一覧を見る
          </Link>
          <Link
            href={`/admin/events`}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            イベント一覧に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function EventAttendanceReportPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
      <EventAttendanceReportPageContent />
    </RoleGuard>
  );
}
