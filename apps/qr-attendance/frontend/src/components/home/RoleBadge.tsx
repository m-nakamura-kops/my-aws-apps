'use client';

/**
 * 役割バッジ（WBS 2-3）
 * ヘッダーに現在の役割（利用者 / スタッフ / 管理者）を表示する。
 */
type RoleLabel = '利用者' | 'スタッフ' | '管理者';

interface RoleBadgeProps {
  roleLabel: string;
}

const styles: Record<RoleLabel, string> = {
  利用者: 'bg-gray-100 text-gray-800 border-gray-300',
  スタッフ: 'bg-blue-100 text-blue-800 border-blue-300',
  管理者: 'bg-purple-100 text-purple-800 border-purple-300',
};

export default function RoleBadge({ roleLabel }: RoleBadgeProps) {
  const normalized = (roleLabel === '管理者' ? '管理者' : roleLabel === 'スタッフ' ? 'スタッフ' : '利用者') as RoleLabel;
  const style = styles[normalized];

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${style}`}
      aria-label={`現在の役割: ${roleLabel}`}
    >
      {roleLabel}
    </span>
  );
}
