-- 打刻に「入室」「退出」の種別を追加し、1人1イベントで入室・退出の両方を記録可能にする
-- 実行: mysql -u root -p qr_attendance < database/migrations/006_attendance_logs_add_type_entry_exit.sql

-- 1. 既存の uk_event_email を削除（存在する場合）
ALTER TABLE attendance_logs DROP INDEX uk_event_email;

-- 2. type カラム追加（entry=入室, exit=退出）
ALTER TABLE attendance_logs
ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'entry' COMMENT 'entry=入室 exit=退出' AFTER event_id;

-- 3. in_time を NULL 許容に（exit 行は in_time を使わず out_time のみ使用）
ALTER TABLE attendance_logs
MODIFY COLUMN in_time DATETIME NULL COMMENT '入室時刻（entry時必須）';

-- 4. 既存データ移行: out_time が設定されている行について exit 行を追加
INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email, notes, created_at, updated_at)
SELECT email, event_id, 'exit', NULL, out_time, staff_email, notes, created_at, updated_at
FROM attendance_logs
WHERE type = 'entry' AND out_time IS NOT NULL;

-- 5. 元の行の out_time を NULL に（entry 行は入室時刻のみ保持）
UPDATE attendance_logs SET out_time = NULL, updated_at = CURRENT_TIMESTAMP WHERE type = 'entry' AND out_time IS NOT NULL;

-- 6. （変更）複数回入退室を許可するため、(event_id, email, type) の UNIQUE は付与しない。
-- 既に uk_event_email_type がある環境は database/migrations/007_drop_uk_event_email_type.sql を実行すること。
