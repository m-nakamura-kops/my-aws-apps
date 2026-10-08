'use client';

import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  redirectTo?: string;
}

/**
 * 役割ベースのルーティング保護コンポーネント
 */
export function RoleGuard({ children, allowedRoles, redirectTo = '/' }: RoleGuardProps) {
  const { role, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }

      if (role && !allowedRoles.includes(role)) {
        router.push(redirectTo);
        return;
      }
    }
  }, [role, isLoading, isAuthenticated, allowedRoles, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // roleがnullでも、認証済みの場合はデフォルトでUSERとして扱う（後で更新される可能性がある）
  // ただし、allowedRolesにUSERが含まれている場合は表示を許可
  if (!role) {
    // USERロールを許可している場合は表示を許可（roleFlagがまだ読み込まれていない可能性がある）
    if (allowedRoles.includes(UserRole.USER)) {
      return <>{children}</>;
    }
    // それ以外の場合はローディングを表示
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
