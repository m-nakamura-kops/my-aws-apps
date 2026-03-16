# データベーススキーマ

## 概要

QRコード打刻システムのデータベーススキーマ定義です。

## テーブル構成

### 1. users（ユーザーテーブル）
- **主キー**: `email`
- **説明**: システム利用者（利用者・スタッフ・管理者）の情報を管理
- **重要なカラム**:
  - `role_flag`: 1=利用者, 2=スタッフ等, 3=管理者
  - `email`: ログインIDとして使用

### 2. events（イベントテーブル）
- **主キー**: `event_id` (AUTO_INCREMENT)
- **説明**: イベント情報を管理
- **重要なカラム**:
  - `event_date`: 開催日時
  - `capacity`: 定員（NULL可）

### 3. registrations（参加申込テーブル）
- **主キー**: `reg_id` (AUTO_INCREMENT)
- **外部キー**: 
  - `email` → `users.email`
  - `event_id` → `events.event_id`
- **説明**: ユーザーのイベント参加申込を管理
- **制約**: 同一ユーザーの同一イベントへの重複登録を防止（UNIQUE制約）

### 4. attendance_logs（打刻履歴テーブル）
- **主キー**: `log_id` (AUTO_INCREMENT)
- **外部キー**: 
  - `email` → `users.email`
  - `event_id` → `events.event_id`
  - `staff_email` → `users.email` (**必須: NOT NULL**)
- **説明**: QRコード・手動打刻の履歴を管理。`notes` に手動打刻時は「手動打刻」を記録
- **重要な制約**: 
  - `staff_email`は必須（NOT NULL）で、`users.email`を参照
  - **UNIQUE( event_id, email )**: 同一イベント・同一利用者の二重打刻をDB層で防止（マイグレーション 003 で追加）

## 使用方法

### データベース作成

```bash
# MySQL/MariaDBの場合
mysql -u root -p < schema.sql

# または、データベース名を指定
mysql -u root -p qr_attendance < schema.sql

# マイグレーション（schema 適用後に実行。database/ がカレントのとき）
mysql -u root -p qr_attendance < migrations/002_add_attendance_logs_notes.sql   # notes カラム追加
mysql -u root -p qr_attendance < migrations/003_add_unique_event_email_attendance_logs.sql   # 二重打刻防止 UNIQUE
```

### 接続情報

本番環境ではAmazon RDSを使用します。接続情報は環境変数で管理してください。

### 結合テスト用テストデータの投入

管理者・スタッフ・利用者の3種のテストユーザーを作成する場合:

- **SQLで投入**: `mysql -u root -p qr_attendance < database/seed-test-users.sql`
- **Node.jsで投入**: `cd apps/qr-attendance/backend && npm run seed-test-users`（backend/.env に DB 設定が必要）

作成されるユーザー: `it-admin@example.com`（管理者）, `it-staff@example.com`（スタッフ）, `it-user@example.com`（利用者）。共通パスワード: `TestPass12`。

## ビュー

### v_event_participants
イベント参加者一覧を取得するビュー

### v_attendance_details
打刻履歴の詳細情報（滞在時間の自動計算含む）を取得するビュー

## 注意事項

- すべてのテーブルで`utf8mb4`文字セットを使用（絵文字対応）
- `created_at`と`updated_at`は自動的に管理されます
- 外部キー制約により、データの整合性が保証されます
- `staff_email`は必ず`users`テーブルに存在するメールアドレスを参照する必要があります
