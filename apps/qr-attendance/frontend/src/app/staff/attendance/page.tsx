'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { apiClient } from '@/lib/api-client';
import { getCurrentUser } from 'aws-amplify/auth';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import SuccessAlert from '@/components/ui/SuccessAlert';
// html5-qrcodeは動的インポートを使用（Next.jsのSSR対応）
let Html5Qrcode: any = null;
if (typeof window !== 'undefined') {
  import('html5-qrcode').then((module) => {
    Html5Qrcode = module.Html5Qrcode;
  });
}

function AttendancePageContent() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const qrCodeScannerRef = useRef<InstanceType<typeof Html5Qrcode> | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const stopScanning = useCallback(async () => {
    if (qrCodeScannerRef.current) {
      try {
        await qrCodeScannerRef.current.stop();
        qrCodeScannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping QR scanner:', err);
      }
      qrCodeScannerRef.current = null;
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
            const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));
            userEmail = tokenPayload.email || '';
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

  useEffect(() => {
    return () => {
      // QRコードスキャナーのクリーンアップ
      if (qrCodeScannerRef.current) {
        qrCodeScannerRef.current.stop().catch(() => {
          // エラーは無視（既に停止している場合など）
        });
        qrCodeScannerRef.current.clear();
        qrCodeScannerRef.current = null;
      }
    };
  }, []);

  // scanningがtrueになったときにスキャナーを開始
  useEffect(() => {
    if (!scanning) return;

    const initScanner = async () => {
      try {
        // DOM要素が確実に存在するまで待つ
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

        const scannerId = 'qr-reader';
        
        // 既存のスキャナーがあれば停止
        if (qrCodeScannerRef.current) {
          try {
            await qrCodeScannerRef.current.stop();
            qrCodeScannerRef.current.clear();
          } catch (e) {
            // 既に停止している場合は無視
          }
        }
        
        // Html5Qrcodeインスタンスを作成
        const qrCodeScanner = new Html5Qrcode(scannerId);
        qrCodeScannerRef.current = qrCodeScanner;

        // QRコード読み取りコールバック関数を定義
        const onQRCodeScanned = async (decodedText: string) => {
          // QRコードが読み取られた
          console.log('QRコードを検出:', decodedText);
          
          // スキャンを停止して処理を実行
          try {
            await qrCodeScanner.stop();
            await handleQRCodeInput(decodedText);
          } catch (err: any) {
            console.error('QRコード処理エラー:', err);
            setError(err.message || 'QRコードの処理に失敗しました');
            setScanning(false);
          }
        };

        // カメラでスキャンを開始
        await qrCodeScanner.start(
          { facingMode: 'environment' }, // 背面カメラを優先
          {
            fps: 10, // フレームレート
            qrbox: { width: 250, height: 250 }, // スキャンエリア
          },
          onQRCodeScanned,
          (errorMessage: string) => {
            // エラーは無視（スキャン中の継続的なエラーは正常）
            // ただし、重大なエラーの場合はログに記録
            if (errorMessage && !errorMessage.includes('NotFoundException')) {
              console.debug('QRスキャンエラー（無視）:', errorMessage);
            }
          }
        );
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
          try {
            await qrCodeScannerRef.current.stop();
            qrCodeScannerRef.current.clear();
          } catch (stopErr) {
            // 停止エラーは無視
          }
          qrCodeScannerRef.current = null;
        }
      }
    };

    initScanner();
  }, [scanning, handleQRCodeInput]);

  const startScanning = async () => {
    try {
      setError('');
      setSuccess('');
      
      // クライアントサイドでのみ実行
      if (typeof window === 'undefined') {
        setError('この機能はブラウザでのみ利用可能です');
        return;
      }
      
      // カメラ権限を確認
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // テスト用のストリームを停止
        stream.getTracks().forEach(track => track.stop());
      } catch (permErr: any) {
        if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
          setError('カメラへのアクセスが拒否されました。ブラウザの設定でカメラの許可を確認してください。');
          return;
        } else if (permErr.name === 'NotFoundError' || permErr.name === 'DevicesNotFoundError') {
          setError('カメラが見つかりませんでした。デバイスにカメラが接続されているか確認してください。');
          return;
        } else {
          setError(`カメラアクセスのエラー: ${permErr.message || permErr.name}`);
          return;
        }
      }
      
      // scanningをtrueに設定すると、useEffectがスキャナーを開始する
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
            href="/home"
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
                style={{ aspectRatio: '1/1', maxWidth: '500px', margin: '0 auto' }}
              >
                <div id="qr-reader" className="w-full h-full"></div>
              </div>
              <p className="text-center text-gray-600 mt-4 text-sm">
                QRコードをカメラの中央に合わせてください
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

export default function AttendancePage() {
  return (
    <RoleGuard allowedRoles={[UserRole.STAFF, UserRole.ADMIN]}>
      <AttendancePageContent />
    </RoleGuard>
  );
}
