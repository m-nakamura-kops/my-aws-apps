import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <article className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6 sm:p-8 space-y-6 text-gray-800">
        <h1 className="text-2xl font-bold text-gray-900">プライバシーポリシー</h1>
        <p className="text-sm text-gray-500">最終更新日: 2026年8月23日</p>
        <p>
          当方は、個人情報の保護に関する法律（個人情報保護法）その他関連法令を遵守し、本サービス（スクール・講座・イベントの出席管理システム）における個人情報を、以下のとおり取り扱います。
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. 取得する情報</h2>
          <p>当方は、本サービスの提供にあたり、次の情報を取得することがあります。</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>氏名（漢字・カナ）、メールアドレス、電話番号</li>
            <li>所属・組織に関する情報、アカウントの権限</li>
            <li>講座・イベントの申込情報、出席（入退室）記録、打刻に関する備考</li>
            <li>認証に必要な識別子（Cognito 等のユーザーID）およびログインに伴う技術情報</li>
            <li>利用規約・本ポリシーへの同意日時</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. 利用目的</h2>
          <p>取得した個人情報は、次の目的の範囲で利用します。</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>講座・イベントの運営、出欠確認、会場運営</li>
            <li>利用者・保護者・スタッフへの連絡（日程変更、緊急連絡を含む）</li>
            <li>出席管理、安全管理、所在確認が必要な場合の対応</li>
            <li>本人確認、アカウント管理、不正利用の防止</li>
            <li>法令に基づく対応、およびサービス改善のための集計（個人を特定しない統計を含む）</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. 第三者提供</h2>
          <p>
            当方は、法令に基づく場合、人の生命・身体・財産の保護のために必要で本人の同意を得ることが困難な場合、または業務委託先に必要な範囲で預ける場合を除き、本人の同意なく個人情報を第三者に提供しません。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. 委託</h2>
          <p>
            当方は、クラウド基盤（認証、データベース、ホスティング等）の提供事業者に、本サービスの運営に必要な範囲で個人情報の取扱いを委託することがあります。委託先には適切な監督を行います。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. 保管期間</h2>
          <p>
            個人情報は、利用目的の達成に必要な期間保管し、不要となったときは遅滞なく消去または匿名化します。法令で保管が義務付けられる場合はその期間に従います。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. 安全管理</h2>
          <p>
            当方は、不正アクセス、漏えい、滅失、毀損の防止のため、アクセス制御、通信の暗号化、権限管理等の合理的な安全管理措置を講じます。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. 開示・訂正・利用停止等</h2>
          <p>
            本人から保有個人データの開示、訂正、追加、削除、利用停止等の請求があった場合、法令に従い遅滞なく対応します。請求窓口は運営者までお問い合わせください。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Cookie 等</h2>
          <p>
            本サービスは、ログイン状態の維持等のためにブラウザの保存領域（localStorage 等）を利用します。これらはサービスの提供に必要な範囲で使用します。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. 本ポリシーの変更</h2>
          <p>
            当方は、法令の改正やサービス内容の変更に応じて本ポリシーを改定することがあります。重要な変更は本サービス上で周知します。
          </p>
        </section>

        <p>
          サービスの利用条件については
          <Link href="/terms" className="text-indigo-600 hover:underline">
            利用規約
          </Link>
          をご確認ください。
        </p>
        <p>
          <Link href="/login" className="text-sm text-gray-500 hover:underline">
            ログインへ戻る
          </Link>
        </p>
      </article>
    </main>
  );
}
