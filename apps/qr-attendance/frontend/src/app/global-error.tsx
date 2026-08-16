'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error) console.error('Global error:', error);
  }, [error]);

  const message = error?.message || 'An unexpected error occurred';

  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f9fafb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', color: '#1f2937', marginBottom: '0.5rem' }}>System Error</h1>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>{message}</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '1rem' }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
