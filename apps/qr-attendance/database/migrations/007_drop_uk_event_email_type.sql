-- 複数回入退室（entry -> exit -> entry -> ...）を許可するため、
-- 旧マイグレーションで追加された uk_event_email_type を削除する。
-- 実行例: mysql -u root -p qr_attendance < database/migrations/007_drop_uk_event_email_type.sql

ALTER TABLE attendance_logs DROP INDEX uk_event_email_type;
