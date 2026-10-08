# No.6.4 利用者・スタッフ・管理者向け画面実装 — 具体的タスク一覧

**WBS**: No.6.4 実装 (Coding) - FE「利用者・スタッフ・管理者向け画面実装」  
**参照**: [FE_UI_UX_DESIGN_2-1.md](./FE_UI_UX_DESIGN_2-1.md)、[SECURITY_DESIGN.md](./SECURITY_DESIGN.md)、[FE_2-3_HOME_MENU_DESIGN.md](./FE_2-3_HOME_MENU_DESIGN.md)

---

## 前提・既に実装済み（6.4 の範囲内）

| 画面 | パス | 状態 |
|------|------|------|
| QRスキャン打刻 | `/staff/scan` | 実装済。手動打刻への入口「QRが読めない場合はこちら」追加済。 |
| 手動打刻 | `/staff/manual` | 実装済。イベント選択→生徒検索→打刻→完了後「QRスキャンに戻る」強調。管理者のみ「新規生徒登録」リンク。 |

---

## 6.4 具体的実装タスク（未整備・強化対象）

### 利用者向け

| No. | 画面名 | パス | 具体的なタスク内容 | 対応API | 既存 | 優先度 |
|-----|--------|------|-------------------|---------|------|--------|
| 6.4.1 | マイページ | `/user/me` | 自分のプロフィール表示（名前・メール・役割表示）。編集は任意。認証必須・本人のみ。 | GET /v1/users/me | あり（要確認・整備） | 高 |
| 6.4.2 | イベント一覧 | `/events` | 公開イベント一覧表示・申込入口。認証必須。カードまたは表で event_name, event_date, 申込ボタン。 | GET /v1/events | あり（要確認・整備） | 高 |
| 6.4.3 | イベント詳細・申込 | `/events/[eventId]` | イベント詳細表示・申込/取消ボタン。申込済みなら「取消」表示。 | GET /v1/events, POST/DELETE register | あり（要確認・整備） | 高 |
| 6.4.4 | 打刻用QR表示 | `/my-qr` | 利用者QR表示（スタッフがスキャン用）。有効期限表示。 | GET /v1/users/me/qr | あり（要確認・整備） | 高 |
| 6.4.5 | 打刻履歴 | `/history` | 自分の打刻履歴一覧。event_name, in_time, out_time 等。 | GET /v1/users/attendance/history | あり（要確認・整備） | 高 |
| 6.4.6 | 参加申込一覧 | `/user/registrations` または `/registrations` | 自分が申し込んだイベント一覧。取消リンク。 | GET /v1/users/registrations | あり（要確認・整備） | 高 |
| 6.4.7 | スケジュール | `/user/events` または `/schedule` | 申込イベント＋打刻状況（月別等）。 | GET /v1/users/schedule | あり（要確認・整備） | 中 |

### スタッフ・管理者向け（打刻以外）

| No. | 画面名 | パス | 具体的なタスク内容 | 対応API | 既存 | 優先度 |
|-----|--------|------|-------------------|---------|------|--------|
| 6.4.8 | 出席確認（参加者一覧） | `/admin/events/[eventId]/participants` | イベント別の参加者・打刻状況。スタッフ/管理者は全員、利用者は自分のみ（APIでスコープ分岐済）。 | GET /v1/admin/events/{id}/participants | あり（要確認・整備） | 高 |

### 管理者向け（管理機能）

| No. | 画面名 | パス | 具体的なタスク内容 | 対応API | 既存 | 優先度 |
|-----|--------|------|-------------------|---------|------|--------|
| 6.4.9 | イベント管理（一覧） | `/admin/events` | イベント一覧・新規作成ボタン・各行に編集・削除・QR・出席レポート・参加者リンク。 | GET/POST/PUT/DELETE /v1/admin/events, GET qr | あり（要確認・整備） | 高 |
| 6.4.10 | イベント編集 | `/admin/events/events/[eventId]` | イベント編集フォーム。event_name, event_date, location, capacity, summary。 | PUT /v1/admin/events/{id} | あり（要確認・整備） | 高 |
| 6.4.11 | 出席レポート | `/admin/events/[eventId]/attendance-report` | イベント別の出席状況表示。 | GET attendance-report | あり（要確認・整備） | 高 |
| 6.4.12 | レポートCSV | `/admin/reports` または イベント別 | 出席CSVダウンロード入口・イベント選択→CSV取得。 | GET /v1/admin/reports/events/{id}/csv | あり（要確認・整備） | 中 |
| 6.4.13 | 生徒名簿管理 | `/admin/students` | 生徒一覧・新規登録・編集・削除・CSVインポート。RoleGuard 管理者のみ。 | list/create/update/delete/import | あり（要確認・整備） | 高 |
| 6.4.14 | スタッフ管理 | `/admin/staffs` | スタッフ一覧・招待・権限変更・「利用者に変更」。 | GET/POST/PUT/DELETE /v1/admin/staffs, invite | あり（要確認・整備） | 高 |
| 6.4.15 | 参加申込一覧（全利用者） | `/admin/registrations` | 全利用者のイベント参加申込一覧。 | （必要に応じてAPI確認） | あり（要確認・整備） | 中 |
| 6.4.16 | お知らせ管理 | `/admin/news` | お知らせ一覧・作成・編集・削除。スタッフ以上。 | GET /v1/news, POST/PUT/DELETE admin/news | 要確認 | 中 |

---

## 実装順序の提案（6.4 構築開始）

1. **利用者向けの整備**: マイページ（6.4.1）→ イベント一覧・詳細・申込（6.4.2, 6.4.3）→ 打刻履歴・申込一覧（6.4.5, 6.4.6）の順で、既存ページの動作確認と不足部分の実装。
2. **管理者向けの整備**: イベント管理一覧・編集（6.4.9, 6.4.10）→ 生徒名簿管理（6.4.13）→ スタッフ管理（6.4.14）→ 出席レポート・参加者一覧（6.4.11, 6.4.8）。
3. **レポート・お知らせ**: レポートCSV（6.4.12）、お知らせ管理（6.4.16）は既存有無を確認の上で整備。

---

## 権限・ガード

- 全画面で未認証は `/login` へ。
- 利用者専用: 認証済みなら誰でも。必要に応じて RoleGuard は不要。
- スタッフ以上: `RoleGuard allowedRoles={[UserRole.STAFF, UserRole.ADMIN]}`（例: 出席確認）。
- 管理者のみ: `RoleGuard allowedRoles={[UserRole.ADMIN]}`（例: `/admin/events`, `/admin/students`, `/admin/staffs`, `/admin/reports`）。  
  `app/admin/layout.tsx` で一括ガードしている場合はそのまま利用。

---

## 完了基準（6.4 完了の定義）

- 利用者: マイページ・イベント一覧・イベント詳細（申込/取消）・マイQR・打刻履歴・申込一覧が、SECURITY_DESIGN の権限に沿って動作すること。
- スタッフ以上: QRスキャン・手動打刻・出席確認（参加者一覧）が利用できること。
- 管理者: イベントCRUD・生徒名簿管理・スタッフ管理・出席レポート・レポートCSV・参加申込一覧・お知らせ管理が利用できること。
- いずれの画面も、権限外のアクセスは 403 またはリダイレクトで弾かれていること。
