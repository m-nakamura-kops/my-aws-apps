-- お知らせテーブル (news) 追加マイグレーション
-- 実行: mysql -u root -p qr_attendance < database/migrations/001_add_news_table.sql

CREATE TABLE IF NOT EXISTS news (
    id INT NOT NULL AUTO_INCREMENT COMMENT 'お知らせID',
    title VARCHAR(255) NOT NULL COMMENT 'お知らせの見出し',
    content TEXT NOT NULL COMMENT 'お知らせの詳細内容',
    published_at DATETIME NOT NULL COMMENT '掲載開始日時',
    expired_at DATETIME NULL COMMENT '掲載終了日時（NULLは無期限）',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    PRIMARY KEY (id),
    INDEX idx_published_at (published_at),
    INDEX idx_expired_at (expired_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='お知らせテーブル';
