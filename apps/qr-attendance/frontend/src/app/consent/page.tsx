'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ErrorAlert from '@/components/ui/ErrorAlert';
import LoadingButton from '@/components/ui/LoadingButton';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import TermsConsentCheckbox from '@/components/legal/TermsConsentCheckbox';

export default function ConsentPage() {
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading,
    isAdmin,
    needsTermsAcceptance,
    termsStatusLoading,
    acceptTerms,
    logout,
  } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading || termsStatusLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (isAdmin || !needsTermsAcceptance) {
      router.replace('/home');
    }
  }, [isLoading, termsStatusLoading, isAuthenticated, isAdmin, needsTermsAcceptance, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!agreed) {
      setError('利用規約およびプライバシーポリシーへの同意が必要です。');
      return;
    }
    setSubmitting(true);
    try {
      await acceptTerms();
      router.replace('/home');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '同意の記録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || termsStatusLoading) {
    return <LoadingSpinner fullScreen text="読み込み中..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">利用規約への同意</h1>
        <p className="text-sm text-gray-600">
          本サービスをご利用いただく前に、利用規約およびプライバシーポリシーをご確認のうえ、同意してください。同意日時は日本標準時（JST）で記録されます。
        </p>
        <p className="text-sm">
          <Link href="/terms" className="text-indigo-600 hover:underline" target="_blank">
            利用規約を開く
          </Link>
          {' / '}
          <Link href="/privacy" className="text-indigo-600 hover:underline" target="_blank">
            プライバシーポリシーを開く
          </Link>
        </p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}
          <TermsConsentCheckbox checked={agreed} onChange={setAgreed} />
          <LoadingButton type="submit" loading={submitting} variant="primary" className="w-full">
            同意して利用を開始
          </LoadingButton>
        </form>
        <button
          type="button"
          onClick={() => logout().then(() => router.replace('/login'))}
          className="text-sm text-gray-500 hover:underline"
        >
          同意せずログアウト
        </button>
      </div>
    </main>
  );
}
