'use client';

/**
 * 緊急用モバイル表示の警告バナー（デバイス・マトリクス準拠）
 * 画面幅 < 768px のときのみ表示。md 以上では hidden。
 */

export default function EmergencyMobileBanner() {
  return (
    <div
      className="md:hidden flex items-center gap-2 px-4 py-3 bg-amber-100 border-b border-amber-200 text-amber-900 text-sm"
      role="alert"
    >
      <span aria-hidden>⚠️</span>
      <span>※現在は緊急用モバイル表示です</span>
    </div>
  );
}
