export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">
          QRコード打刻システム
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          イベント参加者の打刻管理システムへようこそ
        </p>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4">機能</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>ユーザー登録・ログイン</li>
            <li>イベント管理</li>
            <li>QRコード打刻</li>
            <li>参加履歴確認</li>
            <li>レポート出力</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
