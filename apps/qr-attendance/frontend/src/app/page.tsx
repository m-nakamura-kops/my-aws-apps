import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          QRコード打刻システム
        </h1>
        <p className="text-gray-600 mb-8">
          イベント参加者の打刻管理システムです
        </p>
        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full py-3 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium text-center"
          >
            ログイン
          </Link>
          <Link
            href="/register"
            className="block w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium text-center"
          >
            新規登録
          </Link>
        </div>
      </div>
    </div>
  );
}
