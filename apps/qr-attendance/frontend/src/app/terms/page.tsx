import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <article className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6 sm:p-8 space-y-6 text-gray-800">
        <h1 className="text-2xl font-bold text-gray-900">利用規約</h1>
        <p className="text-sm text-gray-500">最終更新日: 2026年8月23日</p>
        <p>
          本利用規約（以下「本規約」）は、本サービス（スクール・講座・イベント等の出席管理および連絡のためのシステム）の利用条件を定めるものです。利用者（生徒・保護者・スタッフ等。管理者を含みます）は、本サービスを利用することにより本規約に同意したものとみなされます。
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">第1条（適用）</h2>
          <p>
            本規約は、本サービスの提供条件および本サービスの利用に関する運営者（以下「当方」）と利用者との間の権利義務関係を定めることを目的とし、利用者と当方との間の本サービスの利用に関わる一切の関係に適用されます。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">第2条（利用登録）</h2>
          <p>
            利用希望者は、本規約に同意のうえ、当方が定める方法により登録を申請し、当方がこれを承認したときに利用登録が完了します。招待によりアカウントが発行された場合も、初回のパスワード設定またはログイン後の同意をもって本規約が適用されます。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">第3条（サービスの内容）</h2>
          <p>当方は、本サービスにおいて、主として次の機能を提供します。</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>講座・イベントの案内、申込、および運営に必要な連絡</li>
            <li>QRコード等による出席（入退室）の記録および履歴の閲覧</li>
            <li>安全管理（緊急連絡、所在確認に必要な範囲での連絡）</li>
            <li>スタッフ・管理者による名簿管理、打刻補助、レポート作成</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">第4条（アカウント管理）</h2>
          <p>
            利用者は、自己の責任においてIDおよびパスワードを管理するものとします。第三者への貸与、共有は禁止します。不正利用が判明した場合は直ちに当方へ通知してください。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">第5条（禁止事項）</h2>
          <p>利用者は、本サービスの利用にあたり、次の行為をしてはなりません。</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>法令または公序良俗に違反する行為</li>
            <li>他人のアカウントのなりすまし、出席記録の改ざん</li>
            <li>本サービスの運営を妨害する行為、不正アクセス</li>
            <li>他の利用者の個人情報を、本サービスの目的外で利用する行為</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">第6条（サービスの変更・中断）</h2>
          <p>
            当方は、メンテナンス、障害、不可抗力等により、事前の通知なく本サービスの全部または一部を変更、中断、終了することがあります。これによって利用者に生じた損害について、当方に故意または重過失がある場合を除き、責任を負いません。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">第7条（免責）</h2>
          <p>
            本サービスは出席管理の補助を目的とするものであり、通信障害・端末不具合等により打刻が記録されない場合があります。記録漏れが疑われる場合はスタッフへ速やかに申し出てください。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">第8条（規約の変更）</h2>
          <p>
            当方は、必要に応じて本規約を変更できます。変更後の規約は本サービス上に表示した時点から効力を生じます。重要な変更がある場合は、本サービス上で周知します。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">第9条（準拠法・管轄）</h2>
          <p>
            本規約の準拠法は日本法とします。本サービスに関して紛争が生じた場合、当方の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
          </p>
        </section>

        <p>
          個人情報の取扱いについては
          <Link href="/privacy" className="text-indigo-600 hover:underline">
            プライバシーポリシー
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
