'use client';

import Link from 'next/link';

export default function TermsConsentCheckbox({
  checked,
  onChange,
  id = 'terms-accepted',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
        className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      <label htmlFor={id} className="text-sm text-gray-700">
        <Link href="/terms" target="_blank" className="text-indigo-600 hover:underline">
          利用規約
        </Link>
        および
        <Link href="/privacy" target="_blank" className="text-indigo-600 hover:underline">
          プライバシーポリシー
        </Link>
        に同意する
        <span className="text-red-600">（必須）</span>
      </label>
    </div>
  );
}
