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
- **説明**: QRコードによる打刻履歴を管理
- **重要な制約**: `staff_email`は必須（NOT NULL）で、`users.email`を参照

## 使用方法

### データベース作成

```bash
# MySQL/MariaDBの場合
mysql -u root -p < schema.sql

# または、データベース名を指定
mysql -u root -p qr_attendance < schema.sql
```

### 接続情報

本番環境ではAmazon RDSを使用します。接続情報は環境変数で管理してください。

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
