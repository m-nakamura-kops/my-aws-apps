# 回帰テスト結果：入退室打刻・戻るリンク修正後

## 1. 二重打刻防止の回帰確認

### 仕様（修正後）
- **DB**: `attendance_logs` に `type` カラム（'entry' | 'exit'）を追加。ユニーク制約は **`uk_event_email_type` (event_id, email, type)** により、**同一ユーザー・同一イベント・同一種別（入室 or 退出）は1件まで**。
- **API**:
  - **入室（entry）**: 既に `type='entry'` の行が存在する場合は新規INSERTせず、既存レコードの情報で 200 を返す（10秒以内の連打は「入室打刻は既に記録済みです（二重打刻防止）」）。
  - **退出（exit）**: 既に `type='exit'` の行が存在する場合も同様に idempotent で 200 を返す。
  - UNIQUE 違反（ER_DUP_ENTRY）時も既存レコードで 200 を返す。
- **手動打刻**: `action: 'entry'` で入室、`action: 'exit'` で退出。それぞれ既に記録済みの場合は 409 Conflict。

### 確認結果（論理検証）
| 操作 | 期待 | 実装 |
|------|------|------|
| 同一ユーザー・同一イベントで「入室」を連打 | 2件目は新規INSERTされず、既存入室で 200 | ✅ `type='entry'` が既に存在する場合は INSERT せず既存を返却。UNIQUE(event_id, email, type) によりDBでも1件のみ。 |
| 同一ユーザー・同一イベントで「退出」を連打 | 2件目は新規INSERTされず、既存退出で 200 | ✅ `type='exit'` が既に存在する場合は INSERT せず既存を返却。UNIQUE で保証。 |
| 入室→退出→入室（再入室） | 現仕様では「入室」は1イベント1回まで。再入室は別要件なら要検討。 | 現状は 1 イベントにつき entry 1 件・exit 1 件まで。 |

**結論**: **同じ種別（入室 or 退出）の連打は防止されている**。API と DB の両方で二重打刻防止が維持されている。

---

## 2. 実施した修正の概要

### 2.1 打刻の「退出」追加
- **DB**: マイグレーション 006 で `type` 追加、`in_time` を NULL 許容、既存データを entry/exit に分割、`uk_event_email_type` 追加。ビュー `v_attendance_details` を type 対応に更新。
- **API**: スタッフスキャン・旧方式・手動打刻で `action`（entry/exit）を受け付け、それぞれ 1 件ずつ INSERT。二重打刻防止は「同種別で既存ありなら INSERT しない」で維持。
- **FE**: 手動打刻画面で「現在の状態（未打刻/入室済み/退出済み）」を表示し、「入室打刻」「退出打刻」ボタンを配置。

### 2.2 戻る・ホームでログアウトするバグ
- **原因**: 「ホームに戻る」のリンクが `href="/"` になっており、ルートへ遷移していた。また出席確認画面の「イベント一覧に戻る」がスタッフ時に `/admin/events` を指しており、管理者専用のためスタッフがリダイレクトされていた。
- **修正**:
  - スタッフ管理・生徒名簿・レポート・スタッフ用出席・管理者イベント一覧の「ホームに戻る」を **`href="/home"`** に変更。
  - 出席確認（参加者一覧）の「イベント一覧に戻る」を **スタッフのときは `/events`、管理者のときは `/admin/events`** に変更。

---

## 3. 変更ファイル一覧

- `database/migrations/006_attendance_logs_add_type_entry_exit.sql`
- `backend/scripts/run-migration-006.js`
- `backend/functions/users/attendance/index.js`（スタッフスキャン・旧方式の entry/exit 対応）
- `backend/functions/attendance/manual/index.js`（手動打刻の entry/exit 対応）
- `backend/functions/admin/events/participants/index.js`（参加者一覧の type 集約）
- `backend/functions/admin/events/attendance-report/index.js`（出席者数・時間帯集計の type=entry 考慮）
- ビュー `v_attendance_details`（type 対応・実行済み）
- `frontend/src/app/admin/staffs/page.tsx`（href="/home"）
- `frontend/src/app/admin/students/page.tsx`（href="/home"）
- `frontend/src/app/admin/reports/page.tsx`（href="/home"）
- `frontend/src/app/admin/events/events/page.tsx`（href="/home"）
- `frontend/src/app/staff/attendance/page.tsx`（href="/home"）
- `frontend/src/app/admin/events/[eventId]/participants/page.tsx`（スタッフ時は /events へ）
- `frontend/src/app/staff/manual/page.tsx`（ステータス表示・入室/退出ボタン）
- `frontend/src/lib/api-client.ts`（manualPunchAttendance に action 追加）
