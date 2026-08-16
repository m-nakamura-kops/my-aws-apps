'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function RootPageClient() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/home');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', color: '#6b7280' }}>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div style={{ textAlign: 'center', color: '#6b7280' }}>
        <p>ホームへ移動しています...</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
        QRコード打刻システム
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        イベント参加者の打刻管理システムです
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Link
          href="/login"
          style={{
            display: 'block',
            padding: '0.75rem 1rem',
            background: '#4f46e5',
            color: 'white',
            borderRadius: '0.375rem',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          ログイン
        </Link>
        <Link
          href="/register"
          style={{
            display: 'block',
            padding: '0.75rem 1rem',
            border: '1px solid #d1d5db',
            color: '#374151',
            borderRadius: '0.375rem',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          新規登録
        </Link>
      </div>
    </div>
  );
}
