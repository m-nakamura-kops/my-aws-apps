# システムテスト（ST）手順書

**対象**: WBS No.9 システムテスト（ST）  
**前提**: No.8 外部結合テスト（ITb）完了済み。ローカルでのITbおよび修正（マイグレーション006・入退室ロジック・導線修正等）をAWSステージングへ反映したうえで実施する。

**マスターWBS**: [WBS粒度統一と同期手順の確定](https://docs.google.com/spreadsheets/d/1o0mYORBmJ2oIY7nGq-xQ25dWCnrDkkCFRl76Xt0bNb0/edit?usp=sharing)

---

## 1. AWS環境への完全同期

### 1.1 同期対象

| 種別 | 内容 |
|------|------|
| DB | マイグレーション **006**（`type` カラム・入退室分離）。**007** で `uk_event_email_type` を削除し複数回入退室を許可（migrate-006 Lambda でも DROP 済み） |
| バックエンド | Lambda にデプロイされている全関数の最新コード（入退室 type 対応・二重打刻防止・参加者一覧の type 集約・出席レポートの type=entry 考慮・手動打刻 entry/exit・ログイン 503 等） |
| フロントエンド | 手動打刻の入室/退出ボタン・ステータス表示、ホーム/戻るリンク修正、イベント一覧の「出席確認画面へ」等の最新ビルドを S3/CloudFront 等に反映 |

### 1.2 DBマイグレーション（006）の適用

**RDS に対してマイグレーション 006 を実行する。**

- **方法A（推奨）**: RDS に接続可能な環境（bastion、VPC 内 EC2、または Secrets Manager で認証情報を取得したローカル等）で、次のいずれかを実行する。
  - **Node スクリプト**:  
    `apps/qr-attendance/backend` で `DB_HOST` に RDS のエンドポイント、`DB_USER` / `DB_PASSWORD` は Secrets Manager の値または環境変数で設定し、  
    `node scripts/run-migration-006.js` を実行する。
  - **SQL ファイル**:  
    `apps/qr-attendance/database/migrations/006_attendance_logs_add_type_entry_exit.sql` を、RDS に接続した `mysql` クライアントで実行する。  
    ※ 既に `uk_event_email` がある場合は、スクリプト内で DROP してから追加するため、`run-migration-006.js` の利用を推奨。
- **方法B**: 一時的な「マイグレーション実行用」Lambda を用意し、Secrets Manager で認証情報を取得したうえで 006 の内容を実行する。  
- **方法C（推奨・踏み台不要）**: CDK でデプロイされる **Migrate006Lambda**（API Gateway 非公開）を CLI で 1 回だけ invoke する。VPC 内の Lambda から RDS へ接続できるため、現在のインフラと整合する。  
  ```bash
  cd apps/qr-attendance/scripts/staging
  ./00-install-migrate006-deps.sh
  ./01-cdk-deploy-api.sh
  ./02-invoke-migrate006.sh
  ```
  詳細は `docs/STAGING_RUNBOOK.md` を参照。
- **適用後**: `attendance_logs` に `type` カラムがあること。`uk_event_email_type` は **付かない**（複数回入退室用に DROP）。方法 C では **v_attendance_details** も Lambda 内で更新されるため、§1.3 の SQL を別途流す必要はない。

### 1.3 ビュー v_attendance_details の更新（006 適用後）

**方法 C（Migrate006Lambda）を使った場合はスキップ可**（Lambda 内で実行済み）。

それ以外の経路で 006 のみ適用した場合、RDS で次を実行する（type 対応ビューに更新）。

```sql
CREATE OR REPLACE VIEW v_attendance_details AS
SELECT
  entry.log_id,
  entry.email,
  u.name_kanji AS user_name,
  entry.event_id,
  e.event_name,
  e.event_date,
  entry.in_time,
  exit_row.out_time,
  TIMESTAMPDIFF(MINUTE, entry.in_time, exit_row.out_time) AS stay_minutes,
  entry.staff_email,
  staff.name_kanji AS staff_name,
  entry.created_at
FROM attendance_logs entry
LEFT JOIN attendance_logs exit_row ON entry.event_id = exit_row.event_id AND entry.email = exit_row.email AND exit_row.type = 'exit'
INNER JOIN users u ON entry.email = u.email
INNER JOIN events e ON entry.event_id = e.event_id
INNER JOIN users staff ON entry.staff_email = staff.email
WHERE entry.type = 'entry';
```

### 1.4 バックエンド（Lambda）のデプロイ

```bash
cd apps/qr-attendance/infrastructure/cdk
npm run build:lambda   # 全Lambdaのビルド
cdk deploy QrAttendanceApiStack-dev
```

- 各 Lambda は `backend/functions/*` を fromAsset でパッケージするため、**先に各関数ディレクトリで `npm run build` が完了していること**を前提とする。`build:lambda` で一括ビルドされる関数は CDK の package.json に定義されている。
- 環境変数 `DB_SECRET_ARN`, `DB_HOST`, `DB_PORT`, `DB_SSL`, `DB_NAME` 等は CDK で設定済みであること。必要に応じて **接続プール用** に `CONNECTION_LIMIT` を設定する（後述）。

### 1.5 フロントエンドのデプロイ

- 本番/ステージング用のフロントが **S3 + CloudFront** または **Amplify** 等でホストされている場合、Next.js のビルド成果物をデプロイする。
- 例: `npm run build` のあと `out/` または `.next/` を S3 にアップロードし、CloudFront のキャッシュ無効化を行う。
- **ローカルからステージング API を叩く検証**: `apps/qr-attendance/scripts/staging/03-sync-frontend-env.sh` で `frontend/.env.staging.local` を生成し、`cp .env.staging.local .env.local` のうえで `npm run dev`（詳細は `docs/STAGING_RUNBOOK.md`）。

---

## 2. 性能・負荷検証（ST項目）

### 2.1 検証目的

- **Too many connections** および **タイムアウト** が、多数の同時アクセスや連続打刻時に再発しないことを確認する。

### 2.2 接続プール（Connection Pool）の再点検

- **現状**: 各 Lambda 内の `shared/db/connection` で `mysql2.createPool` を使用し、`connectionLimit: 10` が設定されている場合がある。
- **課題**: 同時実行 Lambda 数 × 10 接続が RDS の `max_connections` を超えると **Too many connections** が発生する。
- **推奨**:
  - **AWS 環境（Lambda）**: 環境変数 **`CONNECTION_LIMIT`** を **2 ～ 3** に設定する（例: CDK の Lambda の `environment` に `CONNECTION_LIMIT: '2'` を追加）。  
    または、`backend/shared/db/connection.ts` で `process.env.CONNECTION_LIMIT` を読み、未設定時は 10、Lambda では 2 とする。
  - **RDS**: パラメータグループで **`max_connections`** を必要に応じて増やす（例: 200）。同時実行 Lambda 数 × 2 ～ 3 が上限を超えないようにする。
- **待機設定**: `waitForConnections: true`, `queueLimit: 0`（または適切な正の値）のまま、接続取得で待機するようにする。これにより、一時的な負荷でエラーになりにくくする。

### 2.3 検証手順（AWS 環境）

1. **同時ログイン**: 複数ブラウザまたは負荷ツールで同時にログインリクエストを送り、503 や Too many connections が出ないことを確認する。
2. **連続打刻**: 同一イベント・複数ユーザーで連続して入室/退出打刻を実行し、タイムアウトや 503 が発生しないことを確認する。
3. **並行画面操作**: スタッフ・管理者で出席確認・参加者一覧・レポート等を並行して開き、エラーや白画面にならないことを確認する。

---

## 3. 権限・セキュリティ検証

### 3.1 検証目的

- スタッフ権限・管理者権限で、**導線（ボタン）** および **入退室ロジック** が、他者のデータを破壊せず、意図した権限ガード内で動作することを AWS 環境で再確認する。

### 3.2 チェックリスト（AWS ステージングで実施）

| No. | 項目 | 期待動作 | 確認 |
|-----|------|----------|------|
| 1 | スタッフで「ホームに戻る」 | /home に遷移し、ログアウトしない | |
| 2 | スタッフで「イベント一覧に戻る」（出席確認画面から） | /events に遷移し、ログアウトしない | |
| 3 | スタッフでイベント一覧の「出席確認画面へ」 | /admin/events/[id]/participants が表示される | |
| 4 | 管理者で「ホームに戻る」 | /home に遷移する | |
| 5 | 手動打刻：スタッフが「入室打刻」 | 対象生徒の入室のみ記録され、他者データは変更されない | |
| 6 | 手動打刻：スタッフが「退出打刻」 | 対象生徒の退出のみ記録され、他者データは変更されない | |
| 7 | 利用者で参加申込一覧 | 自分が申し込んだイベントのみ表示される（他者申込は見えない） | |
| 8 | スタッフで出席確認 | 全参加者の打刻状況を閲覧できる（意図した権限内） | |
| 9 | 利用者で出席確認（自分用） | 自分の出欠のみ閲覧できる | |
| 10 | 二重打刻防止 | 同一ユーザー・同一イベントで入室（または退出）を連打しても 1 件のみ記録され、API は 200 で idempotent に応答する | |

---

## 4. WBS ステータスの更新

- **No.8 外部結合テスト（ITb）**: **完了** に更新する。
- **No.9 システムテスト（ST）**: **対応中** に更新する。
- ST 完了後、**No.10 受入テスト（UAT）** へ移行し、中村氏による実機検証が実施できる状態であることを報告する。

更新反映先:
- リポジトリ内: `WBS.md` および `apps/qr-attendance/docs/FE_DEVICE_MATRIX_AND_HYBRID_UI.md` の「7. マスターWBS」セクション。
- マスター: 上記 Google スプレッドシート（WBS粒度統一と同期手順の確定）と内容を一致させる。

---

## 5. ST 完了後の UAT 移行報告（様式）

**WBS ステータス（ST 実施前の反映済み）**
- **No.8 外部結合テスト（ITb）**: 完了
- **No.9 システムテスト（ST）**: 対応中（本手順に従い実施）
- **No.10 受入テスト（UAT）**: 未対応

**ST 完了後に共有する報告文（例）**

> AWS ステージングへの完全同期（DB マイグレーション 006・Lambda・フロントエンド）および性能・権限検証を実施しました。接続プールを Lambda あたり 2 に制限し、Too many connections の再発は確認されませんでした。導線（ホームに戻る・イベント一覧に戻る・出席確認画面へ）および入退室ロジックは、権限ガード内で意図どおり動作することを確認しました。  
> **No.10 受入テスト（UAT）へ移行可能です。** 中村氏による実機検証の実施をお願いします。

- **No.9 更新**: ST 実施後、進捗を「完了」に更新する。
- **マスター WBS**: 上記報告後、Google スプレッドシート「WBS粒度統一と同期手順の確定」の No.8/No.9/No.10 を同期する。
