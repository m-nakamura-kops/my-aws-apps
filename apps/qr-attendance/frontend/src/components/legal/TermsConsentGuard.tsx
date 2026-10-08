'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LegalFooter from '@/components/legal/LegalFooter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/terms',
  '/privacy',
  '/consent',
  '/complete-force-change-password',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function TermsConsentGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { isAuthenticated, isLoading, isAdmin, needsTermsAcceptance, termsStatusLoading } = useAuth();

  const blocking =
    isAuthenticated &&
    !isAdmin &&
    !isPublicPath(pathname) &&
    (termsStatusLoading || needsTermsAcceptance);

  useEffect(() => {
    if (isLoading || !isAuthenticated || isAdmin) return;
    if (isPublicPath(pathname)) return;
    if (termsStatusLoading) return;
    if (needsTermsAcceptance) {
      router.replace('/consent');
    }
  }, [
    isLoading,
    isAuthenticated,
    isAdmin,
    pathname,
    termsStatusLoading,
    needsTermsAcceptance,
    router,
  ]);

  if (blocking) {
    return <LoadingSpinner fullScreen text="利用規約の確認状況を確認しています..." />;
  }

  return (
    <>
      {children}
      {isAuthenticated && pathname !== '/consent' ? <LegalFooter className="px-4 pb-8" /> : null}
    </>
  );
}
