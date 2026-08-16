-- attendance_logs に notes カラムを追加（手動打刻時は '手動打刻' を記録）
-- 実行: mysql -u root -p qr_attendance < database/migrations/002_add_attendance_logs_notes.sql

ALTER TABLE attendance_logs
ADD COLUMN notes VARCHAR(255) NULL COMMENT '備考（手動打刻時は「手動打刻」等）' AFTER staff_email;
