'use client';

import Link from 'next/link';

export default function LegalFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-600 ${className}`}>
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Link href="/terms" className="text-indigo-600 hover:text-indigo-800">
          利用規約
        </Link>
        <Link href="/privacy" className="text-indigo-600 hover:text-indigo-800">
          プライバシーポリシー
        </Link>
      </nav>
    </footer>
  );
}
