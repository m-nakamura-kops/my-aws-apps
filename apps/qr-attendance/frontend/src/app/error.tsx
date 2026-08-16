'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error) console.error('Application error:', error);
  }, [error]);

  const message = error?.message || 'An error occurred';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: '1rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem' }}>Error</h1>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>{message}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '1rem' }}
          >
            Retry
          </button>
          <a
            href="/"
            style={{ display: 'inline-block', padding: '0.75rem 1.5rem', backgroundColor: '#4b5563', color: 'white', borderRadius: '0.375rem', textDecoration: 'none', fontSize: '1rem' }}
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}
