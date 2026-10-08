'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { getCurrentUser } from 'aws-amplify/auth';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import SuccessAlert from '@/components/ui/SuccessAlert';

export default function AttendancePage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const qrCodeScannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const handleQRCodeInputRef = useRef<(url: string) => Promise<void>>(async () => {});
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (e?.reason?.name === 'AbortError' && e?.reason?.message?.includes('play()')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

  const stopScanning = useCallback(async () => {
    if (qrCodeScannerRef.current) {
      const scanner = qrCodeScannerRef.current;
      qrCodeScannerRef.current = null;
      try {
        await scanner.stop();
      } catch (err) {
        // 停止時の removeChild エラーなどは無視
      }
      await new Promise((r) => setTimeout(r, 100));
      try {
        scanner.clear();
      } catch (_err) {
        // clear 内の removeChild が DOM とずれることがあるため握りつぶす
      }
    }
    setScanning(false);
  }, []);

  const handleQRCodeInput = useCallback(async (qrCodeUrl: string) => {
    try {
      setError('');
      setSuccess('');
      
      let data: string | null = null;
      let sig: string | null = null;
      
      // QRコードURLからデータと署名を抽出
      try {
        // 完全なURLの場合
        const url = new URL(qrCodeUrl);
        data = url.searchParams.get('data');
        sig = url.searchParams.get('sig');
      } catch {
        // URL形式でない場合、直接データと署名が含まれている可能性がある
        // 例: "data=xxx&sig=yyy" 形式
        const params = new URLSearchParams(qrCodeUrl);
        data = params.get('data');
        sig = params.get('sig');
      }
      
      if (!data || !sig) {
        setError('無効なQRコードです。QRコードのURLを確認してください。');
        return;
      }

      // ユーザーのメールアドレスを取得（認証情報から）
      // AuthContextから直接取得（getCurrentUser()を呼ばずに高速化）
      let userEmail = '';
      
      if (user) {
        // AuthContextのuserオブジェクトから取得（最速）
        userEmail = user.signInDetails?.loginId || user.username || '';
      }
      
      // まだ取得できない場合は、ローカルストレージから取得を試みる
      if (!userEmail) {
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          try {
            const parts = authToken.split('.');
            const payload = parts.length >= 2
              ? JSON.parse(atob(parts[1]))
              : JSON.parse(atob(authToken));
            userEmail = payload.email || '';
          } catch (e) {
            // トークンの解析に失敗した場合は無視
          }
        }
      }
      
      // それでも取得できない場合は、getCurrentUser()を呼び出す（フォールバック）
      if (!userEmail) {
        try {
          const currentUser = await getCurrentUser();
          userEmail = currentUser.signInDetails?.loginId || currentUser.username || '';
        } catch (err) {
          console.error('Failed to get user email:', err);
        }
      }

      if (!userEmail) {
        setError('ユーザー情報を取得できませんでした。再度ログインしてください。');
        return;
      }

      // 打刻APIを呼び出し
      const response = await apiClient.punchAttendance({
        qr_code_data: data,
        signature: sig,
        email: userEmail,
      });

      setSuccess(response.message || (response.action === 'in' ? '入室打刻が完了しました' : '退室打刻が完了しました'));
      stopScanning();
      
      // 3秒後にメッセージをクリア
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err: any) {
      setError(err.message || '打刻に失敗しました');
      stopScanning();
    }
  }, [stopScanning]);

  handleQRCodeInputRef.current = handleQRCodeInput;

  useEffect(() => {
    return () => {
      const scanner = qrCodeScannerRef.current;
      qrCodeScannerRef.current = null;
      if (scanner) {
        scanner.stop()
          .then(() => new Promise((r) => setTimeout(r, 100)))
          .then(() => {
            try {
              scanner.clear();
            } catch (_e) {}
          })
          .catch(() => {});
      }
    };
  }, []);

  // scanningがtrueになったときにスキャナーを開始
  useEffect(() => {
    if (!scanning || typeof window === 'undefined') return;

    const initScanner = async () => {
      try {
        // クライアントでのみ html5-qrcode を遅延読み込み（ChunkLoadError対策）
        const { Html5Qrcode } = await import('html5-qrcode');

        // DOM要素が確実に存在し、レイアウトが完了するまで待つ（映像が消える AbortError 対策）
        await new Promise<void>((resolve) => {
          const checkElement = () => {
            const element = document.getElementById('qr-reader');
            if (element) {
              resolve();
            } else {
              setTimeout(checkElement, 50);
            }
          };
          checkElement();
        });
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

        const scannerId = 'qr-reader';

        // 既存のスキャナーがあれば停止（stop 完了後に少し待ってから clear）
        if (qrCodeScannerRef.current) {
          try {
            await qrCodeScannerRef.current.stop();
          } catch (_e) {}
          await new Promise((r) => setTimeout(r, 100));
          try {
            qrCodeScannerRef.current.clear();
          } catch (_e) {}
          qrCodeScannerRef.current = null;
        }

        // Html5Qrcodeインスタンスを作成
        const qrCodeScanner = new Html5Qrcode(scannerId);
        qrCodeScannerRef.current = qrCodeScanner;

        // カメラ一覧を取得してから開始（映像が静止する問題の対策）
        const cameras = await Html5Qrcode.getCameras();
        const backCamera = cameras.find((c: { label: string }) => /back|環境|rear/i.test(c.label));
        const cameraId = backCamera?.id || cameras[0]?.id || null;
        const cameraConfig = typeof cameraId === 'string'
          ? cameraId
          : {
              facingMode: 'environment' as const,
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
            };

        // QRコード読み取りコールバック関数を定義
        const onQRCodeScanned = async (decodedText: string) => {
          console.log('QRコードを検出:', decodedText);
          try {
            await qrCodeScanner.stop();
            await handleQRCodeInputRef.current(decodedText);
          } catch (err: any) {
            console.error('QRコード処理エラー:', err);
            setError(err.message || 'QRコードの処理に失敗しました');
            setScanning(false);
          }
        };

        // カメラでスキャンを開始（getCameras で取得したカメラIDを使用すると映像が更新されやすくなる）
        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };
        await qrCodeScanner.start(
          cameraConfig,
          config,
          onQRCodeScanned,
          (errorMessage) => {
            if (errorMessage && !errorMessage.includes('NotFoundException')) {
              console.debug('QRスキャンエラー（無視）:', errorMessage);
            }
          }
        );

        // ライブラリが作成した video に muted と playsInline を設定（play() は呼ばない＝AbortError を防ぐ）
        const ensureVideoAttrs = () => {
          const container = document.getElementById('qr-reader');
          if (!container) return;
          const video = container.querySelector('video');
          if (video && video.isConnected) {
            video.muted = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
          }
        };
        ensureVideoAttrs();
        const observer = new MutationObserver(ensureVideoAttrs);
        const el = document.getElementById('qr-reader');
        if (el) {
          observer.observe(el, { childList: true, subtree: true });
          setTimeout(() => observer.disconnect(), 5000);
        }
        setTimeout(ensureVideoAttrs, 200);
        setTimeout(ensureVideoAttrs, 500);
      } catch (err: any) {
        console.error('QR code scanning error:', err);
        
        // エラーメッセージを詳細化
        let errorMessage = 'カメラへのアクセスが拒否されました。ブラウザの設定を確認してください。';
        if (err.message) {
          if (err.message.includes('Permission denied') || err.message.includes('NotAllowedError')) {
            errorMessage = 'カメラへのアクセスが拒否されました。ブラウザの設定でカメラの許可を確認してください。';
          } else if (err.message.includes('NotFoundError') || err.message.includes('No camera')) {
            errorMessage = 'カメラが見つかりませんでした。デバイスにカメラが接続されているか確認してください。';
          } else if (err.message.includes('not found')) {
            errorMessage = 'スキャナー要素が見つかりませんでした。ページを再読み込みしてください。';
          } else {
            errorMessage = `エラー: ${err.message}`;
          }
        }
        
        setError(errorMessage);
        setScanning(false);
        if (qrCodeScannerRef.current) {
          const scanner = qrCodeScannerRef.current;
          qrCodeScannerRef.current = null;
          try {
            await scanner.stop();
          } catch (_e) {}
          await new Promise((r) => setTimeout(r, 100));
          try {
            scanner.clear();
          } catch (_e) {}
        }
      }
    };

    initScanner();
  }, [scanning]);

  const startScanning = async () => {
    try {
      setError('');
      setSuccess('');
      if (typeof window === 'undefined') {
        setError('この機能はブラウザでのみ利用可能です');
        return;
      }
      // カメラは html5-qrcode が start() で取得する（二重に getUserMedia すると映像が止まることがあるためここでは開かない）
      setScanning(true);
    } catch (err: any) {
      console.error('Start scanning error:', err);
      setError(`エラーが発生しました: ${err.message || '不明なエラー'}`);
      setScanning(false);
    }
  };

  const handleManualInput = () => {
    const qrCodeUrl = prompt('QRコードのURLを入力してください:');
    if (qrCodeUrl) {
      handleQRCodeInput(qrCodeUrl);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="認証情報を確認中..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">QRコード打刻</h1>
            <p className="text-lg text-gray-600">QRコードをスキャンして入退室の打刻を行います</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            ホームに戻る
          </Link>
        </div>

        {error && (
          <ErrorAlert 
            message={error} 
            onDismiss={() => setError('')}
            className="mb-4"
          />
        )}

        {success && (
          <SuccessAlert 
            message={success}
            onDismiss={() => setSuccess('')}
            className="mb-4"
          />
        )}

        <div className="bg-white rounded-lg shadow p-6">
          {!scanning ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <div className="text-6xl mb-4">📱</div>
                <h2 className="text-2xl font-semibold mb-2">QRコードをスキャン</h2>
                <p className="text-gray-600 mb-6">
                  カメラを起動してQRコードをスキャンするか、QRコードのURLを手動で入力してください
                </p>
              </div>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={startScanning}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-semibold"
                >
                  カメラでスキャン
                </button>
                <button
                  onClick={handleManualInput}
                  className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-semibold"
                >
                  URLを手動入力
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold">カメラでスキャン中...</h2>
                <button
                  onClick={stopScanning}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  停止
                </button>
              </div>
              <div 
                ref={scannerContainerRef}
                className="relative bg-black rounded-lg overflow-hidden" 
                style={{ aspectRatio: '1/1', maxWidth: '500px', minHeight: '300px', margin: '0 auto' }}
              >
                <div id="qr-reader" className="w-full h-full min-h-[300px]"></div>
              </div>
              <p className="text-center text-gray-600 mt-4 text-sm">
                QRコードをカメラの中央に合わせてください
              </p>
              <p className="text-center text-gray-500 mt-2 text-xs">
                映像が表示されない場合は「停止」→「カメラでスキャン」をやり直すか、「URLを手動入力」をご利用ください。
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">使い方</h3>
          <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
            <li>イベント管理ページでイベントのQRコードを表示</li>
            <li>QRコードをスキャンするか、QRコードのURLをコピー</li>
            <li>このページで「URLを手動入力」を選択してURLを貼り付け</li>
            <li>打刻が完了するとメッセージが表示されます</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
