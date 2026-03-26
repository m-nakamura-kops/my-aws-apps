'use client';

/**
 * No.6.4.11 管理者：出席レポート表示
 * No.6.4.12 管理者：レポートCSV出力
 * 申込数・出席数・欠席数・出席率（小数点第1位）、0除算ガード、ハイブリッドUI（PC=一覧表/スマホ=カード+警告バナー）、CSVダウンロード（出席レポート_イベント名_出力日.csv）
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { UserRole } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import EmergencyMobileBanner from '@/components/ui/EmergencyMobileBanner';

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

/** 出席率表示用：小数点第1位まで。申込0の場合は 0% を表示（0除算ガード） */
function formatAttendanceRateDisplay(summary: {
  total_registrations: number;
  total_attendees: number;
  attendance_rate: number;
}): string {
  if (summary.total_registrations === 0) return '0%';
  const rate = summary.attendance_rate;
  if (rate == null || Number.isNaN(rate)) return '-';
  return `${Number(rate).toFixed(1)}%`;
}

/** ファイル名用にイベント名の危険文字を置換 */
function sanitizeEventNameForFilename(name: string): string {
  return String(name || 'イベント').replace(/[/\\:*?"<>|]/g, '_').trim() || 'イベント';
}

function EventAttendanceReportPageContent() {
  const params = useParams();
  const eventId = params?.eventId ? parseInt(params.eventId as string, 10) : null;

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csvDownloading, setCsvDownloading] = useState(false);

  useEffect(() => {
    if (eventId) loadReport();
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

  const handleCsvDownload = async () => {
    if (!eventId || !report) return;
    try {
      setCsvDownloading(true);
      setError(null);
      const blob = await apiClient.getEventReportCsvBlob(eventId);
      const now = new Date();
      const outputDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const filename = `出席レポート_${sanitizeEventNameForFilename(report.event_name)}_${outputDate}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'CSVのダウンロードに失敗しました');
    } finally {
      setCsvDownloading(false);
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
    if (hours > 0) return `${hours}時間${mins}分`;
    return `${mins}分`;
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="レポートを読み込み中..." />;
  }

  if (error && !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <ErrorAlert message={error} onRetry={loadReport} className="mb-4" />
          <Link href="/admin/events" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
            イベント一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const summary = report.summary || {};
  const totalAttendeesForBar = summary.total_attendees || 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 緊急用モバイル警告バナー（< 768px のみ） */}
        <EmergencyMobileBanner />

        {/* ヘッダー */}
        <div className="mb-6">
          <Link href="/admin/events" className="text-indigo-600 hover:text-indigo-800 mb-4 inline-block">
            ← イベント一覧に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">出席レポート</h1>
          <p className="text-lg text-gray-600 mt-2">{report.event_name}</p>
          <p className="text-sm text-gray-500">
            {new Date(report.event_date).toLocaleString('ja-JP')}
            {report.location && ` @ ${report.location}`}
          </p>
        </div>

        {error && (
          <ErrorAlert
            message={error}
            onRetry={loadReport}
            onDismiss={() => setError(null)}
            className="mb-4"
          />
        )}

        {/* サマリー：PC=一覧表、スマホ=カード */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
          <h2 className="text-xl font-semibold p-4 border-b border-gray-200">サマリー</h2>
          {/* PC: 一覧表（≥768px） */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">申込数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">出席数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">欠席数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">出席率</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{summary.total_registrations ?? 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{summary.total_attendees ?? 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-yellow-600">{summary.no_show_count ?? 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">{formatAttendanceRateDisplay(summary)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* スマホ: カード（<768px） */}
          <div className="md:hidden grid grid-cols-2 gap-3 p-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">申込数</div>
              <div className="text-xl font-bold text-blue-600">{summary.total_registrations ?? 0}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">出席数</div>
              <div className="text-xl font-bold text-green-600">{summary.total_attendees ?? 0}</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">欠席数</div>
              <div className="text-xl font-bold text-yellow-600">{summary.no_show_count ?? 0}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">出席率</div>
              <div className="text-xl font-bold text-purple-600">{formatAttendanceRateDisplay(summary)}</div>
            </div>
          </div>
        </div>

        {/* 滞在時間統計 */}
        {report.statistics?.stay_duration && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">滞在時間統計</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600">平均滞在時間</div>
                <div className="text-lg font-semibold">{formatDuration(report.statistics.stay_duration.avg_minutes)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">最短滞在時間</div>
                <div className="text-lg font-semibold">{formatDuration(report.statistics.stay_duration.min_minutes)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">最長滞在時間</div>
                <div className="text-lg font-semibold">{formatDuration(report.statistics.stay_duration.max_minutes)}</div>
              </div>
            </div>
          </div>
        )}

        {/* 時間帯別入室数（0除算ガード） */}
        {(report.statistics?.time_slot_distribution?.length ?? 0) > 0 && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">時間帯別入室数</h2>
            <div className="space-y-2">
              {report.statistics.time_slot_distribution.map((stat: any) => (
                <div key={stat.time_slot} className="flex items-center">
                  <div className="w-20 text-sm text-gray-600">{stat.time_slot}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                    <div
                      className="bg-indigo-600 h-6 rounded-full flex items-center justify-end pr-2 min-w-0"
                      style={{
                        width: totalAttendeesForBar > 0 ? `${(stat.count / totalAttendeesForBar) * 100}%` : '0%',
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

        {/* 出席履歴：PC=テーブル、スマホ=カード */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">出席履歴</h2>
          </div>
          {report.attendance_logs.length === 0 ? (
            <div className="p-12 text-center text-gray-600">出席履歴がありません</div>
          ) : (
            <>
              {/* PC: テーブル（≥768px） */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ユーザー名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">メールアドレス</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">入室時刻</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">退室時刻</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">滞在時間</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">担当者</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {report.attendance_logs.map((log: AttendanceLog, index: number) => (
                      <tr key={`${log.log_id}-${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.user_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(log.in_time)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.out_time ? formatDate(log.out_time) : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDuration(log.stay_minutes)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{log.staff_name}</div>
                          <div className="text-xs text-gray-400">{log.staff_email}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* スマホ: カード（<768px） */}
              <div className="md:hidden divide-y divide-gray-200">
                {report.attendance_logs.map((log: AttendanceLog, index: number) => (
                  <div key={`${log.log_id}-${index}`} className="p-4 min-h-[44px] flex flex-col justify-center">
                    <div className="font-medium text-gray-900">{log.user_name}</div>
                    <div className="text-sm text-gray-500">{log.email}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      入室: {formatDate(log.in_time)} / 退室: {log.out_time ? formatDate(log.out_time) : '-'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">滞在: {formatDuration(log.stay_minutes)} · 担当: {log.staff_name}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* アクションボタン（参加者一覧・CSVダウンロード・イベント一覧） */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCsvDownload}
            disabled={csvDownloading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 min-h-[44px] min-w-[44px]"
          >
            {csvDownloading ? 'ダウンロード中...' : 'CSVをダウンロード'}
          </button>
          <Link
            href={`/admin/events/${eventId}/participants`}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 min-h-[44px] inline-flex items-center justify-center"
          >
            参加者一覧を見る
          </Link>
          <Link
            href="/admin/events"
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 min-h-[44px] inline-flex items-center justify-center"
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
