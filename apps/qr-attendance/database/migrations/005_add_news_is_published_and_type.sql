-- お知らせ: 公開フラグとタイプ（通常/重要）を追加
-- 実行: mysql -u root -p qr_attendance < database/migrations/005_add_news_is_published_and_type.sql
-- 既にカラムがある場合はエラーになるため、必要に応じてスキップする。

ALTER TABLE news ADD COLUMN is_published TINYINT NOT NULL DEFAULT 1 COMMENT '1=公開 0=非公開';
ALTER TABLE news ADD COLUMN announcement_type TINYINT NOT NULL DEFAULT 1 COMMENT '1=通常 2=重要（緊急）';
