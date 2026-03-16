-- 二重打刻防止: attendance_logs に (event_id, email) の一意制約を追加
-- 実行: mysql -u root -p qr_attendance < database/migrations/003_add_unique_event_email_attendance_logs.sql
-- 注意: 既に重複データがある場合は事前に解消すること

ALTER TABLE attendance_logs
ADD UNIQUE KEY uk_event_email (event_id, email) COMMENT '同一イベント・同一利用者の二重打刻防止';
