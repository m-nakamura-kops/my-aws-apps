'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import SuccessAlert from '@/components/ui/SuccessAlert';

function StaffScanPageContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const qrCodeScannerRef = useRef<any>(null);
  const lastScannedKeyRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const DEBOUNCE_MS = 3000; // 同一QRの連続送信を防ぐ
  const [events, setEvents] = useState<Array<{ event_id: number; event_name: string; event_date: string }>>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | ''>('');
  const [scanning, setScanning] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      setLoadingEvents(true);
      setError('');
      apiClient
        .listEventsForStaff({ limit: 100 })
        .then((res) => setEvents(res.events || []))
        .catch((err: any) => {
          setEvents([]);
          const msg = err?.message || err?.details || 'イベント一覧の取得に失敗しました';
          setError(msg);
        })
        .finally(() => setLoadingEvents(false));
    }
  }, [isAuthenticated]);

  const stopScanning = useCallback(async () => {
    if (qrCodeScannerRef.current) {
      try {
        await qrCodeScannerRef.current.stop();
        qrCodeScannerRef.current.clear();
      } catch (_err) {}
      qrCodeScannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleScannedUserQr = useCallback(
    async (decodedText: string) => {
      if (selectedEventId === '') {
        setError('先にイベントを選択してください');
        return;
      }
      let data: string | null = null;
      let sig: string | null = null;
      try {
        if (decodedText.includes('?')) {
          const url = new URL(decodedText);
          data = url.searchParams.get('data');
          sig = url.searchParams.get('sig');
        } else {
          const params = new URLSearchParams(decodedText);
          data = params.get('data');
          sig = params.get('sig');
        }
      } catch {
        const params = new URLSearchParams(decodedText);
        data = params.get('data');
        sig = params.get('sig');
      }
      if (!data || !sig) {
        setError('利用者のQRコードを読み取れませんでした。もう一度表示してもらってください。');
        return;
      }
      const key = `${data}|${sig}`;
      const now = Date.now();
      if (lastScannedKeyRef.current === key && now - lastScannedTimeRef.current < DEBOUNCE_MS) {
        return;
      }
      lastScannedKeyRef.current = key;
      lastScannedTimeRef.current = now;
      try {
        setError('');
        setSuccess('');
        const response = await apiClient.punchAttendanceByScan({
          qr_code_data: data,
          signature: sig,
          event_id: Number(selectedEventId),
        });
        setSuccess(response.message || (response.action === 'in' ? '入室打刻が完了しました' : '退室打刻が完了しました'));
        if (qrCodeScannerRef.current) {
          try {
            await qrCodeScannerRef.current.stop();
            qrCodeScannerRef.current.clear();
          } catch (_e) {}
          qrCodeScannerRef.current = null;
        }
        setScanning(false);
        setTimeout(() => setSuccess(''), 3000);
      } catch (err: any) {
        setError(err.message || '打刻に失敗しました');
      }
    },
    [selectedEventId]
  );

  const startScanning = useCallback(async () => {
    if (selectedEventId === '') {
      setError('イベントを選択してください');
      return;
    }
    setError('');
    setSuccess('');
    setStartingCamera(true);
    setScanning(true);
  }, [selectedEventId]);

  // scanning が true になり #staff-qr-reader が DOM に描画された後にカメラを開始
  useEffect(() => {
    if (!scanning || !startingCamera || typeof window === 'undefined') return;

    const initCamera = async () => {
      const scannerId = 'staff-qr-reader';
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        await new Promise<void>((resolve) => {
          const check = () => {
            if (document.getElementById(scannerId)) {
              resolve();
            } else {
              requestAnimationFrame(check);
            }
          };
          requestAnimationFrame(check);
        });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        if (qrCodeScannerRef.current) {
          try {
            await qrCodeScannerRef.current.stop();
            qrCodeScannerRef.current.clear();
          } catch (_e) {}
          qrCodeScannerRef.current = null;
        }

        const scanner = new Html5Qrcode(scannerId);
        qrCodeScannerRef.current = scanner;

        const scanConfig = { fps: 10, qrbox: { width: 250, height: 250 } };
        const onScan = (decodedText: string) => handleScannedUserQr(decodedText);
        const onError = () => {};

        let cameraConfig: string | { facingMode: 'environment' | 'user' };
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras?.length > 0) {
            const back = cameras.find((c: { label: string }) => /back|環境|rear/i.test(c.label));
            const id = back?.id ?? cameras[0]?.id;
            cameraConfig = id != null ? id : { facingMode: 'user' };
          } else {
            cameraConfig = { facingMode: 'user' };
          }
        } catch {
          cameraConfig = { facingMode: 'user' };
        }

        try {
          await scanner.start(cameraConfig, scanConfig, onScan, onError);
        } catch {
          await scanner.start({ facingMode: 'user' }, scanConfig, onScan, onError);
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (/Permission|NotAllowed|許可|permission denied/i.test(msg)) {
          setError('カメラの使用が許可されていません。ブラウザの設定でカメラを許可してください。');
        } else if (/NotFound|no device|デバイス|not found/i.test(msg)) {
          setError('カメラが見つかりません。接続を確認するか、別のカメラを選択してください。');
        } else if (/secure|HTTPS|secure context/i.test(msg)) {
          setError('カメラは安全な接続（HTTPS または localhost）でのみ利用できます。');
        } else {
          setError(msg || 'カメラの起動に失敗しました');
        }
        setScanning(false);
      } finally {
        setStartingCamera(false);
      }
    };

    initCamera();
  }, [scanning, startingCamera, handleScannedUserQr]);

  useEffect(() => {
    return () => {
      if (qrCodeScannerRef.current) {
        qrCodeScannerRef.current.stop().catch(() => {}).then(() => {
          try {
            qrCodeScannerRef.current?.clear();
          } catch (_e) {}
        });
      }
    };
  }, []);

  if (isLoading) {
    return <LoadingSpinner fullScreen text="認証情報を確認中..." />;
  }
  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">打刻スキャン</h1>
            <p className="text-gray-600 text-sm">
              利用者が表示したQRコードをスキャンして入退室を記録します
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/staff/manual"
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm"
            >
              QRが読めない場合はこちら
            </Link>
            <Link
              href="/home"
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              ホーム
            </Link>
          </div>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError('')} className="mb-4" />}
        {success && <SuccessAlert message={success} onDismiss={() => setSuccess('')} className="mb-4" />}

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">イベントを選択</label>
          {loadingEvents ? (
            <p className="text-gray-500 text-sm">読み込み中...</p>
          ) : (
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={scanning}
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

        {!scanning ? (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm mb-4">
              利用者にスマホで「打刻用QR表示」画面を表示してもらい、そのQRをこの画面のカメラでスキャンします。
            </p>
            <button
              onClick={startScanning}
              disabled={selectedEventId === '' || loadingEvents}
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              カメラでスキャン開始
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">スキャン中</h2>
              <button
                onClick={stopScanning}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                停止
              </button>
            </div>
            <div
              className="relative bg-black rounded-lg overflow-hidden mx-auto"
              style={{ maxWidth: 500, aspectRatio: '1/1', minHeight: 250 }}
            >
              <div id="staff-qr-reader" className="w-full h-full min-h-[250px]" />
              {startingCamera && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <p className="text-white text-sm">カメラを起動しています...</p>
                </div>
              )}
            </div>
            <p className="text-center text-gray-500 text-sm mt-2">
              利用者のスマホに表示されたQRコードを枠内に合わせてください
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function StaffScanPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.STAFF, UserRole.ADMIN]}>
      <StaffScanPageContent />
    </RoleGuard>
  );
}
