'use client';

/**
 * No.6.4.4 利用者：打刻用QR表示 (/my-qr)
 * マイページ等から自分のQRコードを大きく表示。有効期限付きQR表示。
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';

const REFRESH_INTERVAL_MS = 9 * 60 * 1000; // 9分（QR有効10分より手前で更新）

export default function MyQrPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [qrData, setQrData] = useState<{ qr_code_data: string; signature: string; expires_at: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadQr = useCallback(async () => {
    try {
      setError('');
      const res = await apiClient.getMyQrData();
      setQrData({
        qr_code_data: res.qr_code_data,
        signature: res.signature,
        expires_at: res.expires_at,
      });
    } catch (err: any) {
      setError(err.message || 'QRコードの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadQr();
    }
  }, [isAuthenticated, loadQr]);

  useEffect(() => {
    if (!qrData) return;
    const t = setInterval(loadQr, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [qrData, loadQr]);

  if (isLoading) {
    return <LoadingSpinner fullScreen text="認証情報を確認中..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  const qrValue = qrData
    ? `data=${encodeURIComponent(qrData.qr_code_data)}&sig=${encodeURIComponent(qrData.signature)}`
    : '';

  return (
    <main className="min-h-screen p-6 bg-gray-50 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold mb-2">打刻用QR表示</h1>
          <p className="text-gray-600 text-sm">
            受付用QRコードの表示。この画面をスタッフに見せて、QRコードをスキャンしてもらってください
          </p>
        </div>

        {error && (
          <ErrorAlert
            message={error}
            onRetry={loadQr}
            onDismiss={() => setError('')}
            className="mb-4"
          />
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : qrData ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center">
            <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
              <QRCodeSVG
                value={qrValue}
                size={320}
                level="M"
                includeMargin
              />
            </div>
            <p className="text-gray-500 text-sm mt-4">
              有効期限: {new Date(qrData.expires_at).toLocaleTimeString('ja-JP')} 頃（約10分で自動更新）
            </p>
          </div>
        ) : null}

        <div className="mt-8 text-center">
          <Link
            href="/home"
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            ← ホームに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
