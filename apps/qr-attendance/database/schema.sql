-- ============================================
-- QRコード打刻システム データベーススキーマ
-- ============================================
-- 作成日: 2026-02-15
-- 説明: テーブル定義書に基づく完全なDDL定義
-- ============================================

-- データベース作成（必要に応じて）
-- CREATE DATABASE qr_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE qr_attendance;

-- ============================================
-- 1. ユーザーテーブル (users)
-- ============================================
CREATE TABLE users (
    email VARCHAR(255) NOT NULL COMMENT 'メールアドレス',
    password VARCHAR(100) NOT NULL COMMENT 'パスワード',
    name_kanji VARCHAR(50) NOT NULL COMMENT '氏名（漢字）',
    name_kana VARCHAR(100) NOT NULL COMMENT 'カナ（フリガナ）',
    tel VARCHAR(15) NOT NULL COMMENT '電話番号',
    org_id VARCHAR(20) NULL COMMENT '組織ID',
    role_flag INT NOT NULL COMMENT '役割フラグ: 1=利用者, 2=スタッフ等, 3=管理者',
    remarks TEXT NULL COMMENT '備考',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    PRIMARY KEY (email),
    INDEX idx_org_id (org_id),
    INDEX idx_role_flag (role_flag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ユーザーテーブル';

-- ============================================
-- 2. イベントテーブル (events)
-- ============================================
CREATE TABLE events (
    event_id INT NOT NULL AUTO_INCREMENT COMMENT 'イベントID',
    event_name VARCHAR(100) NOT NULL COMMENT '名称',
    event_date DATETIME NOT NULL COMMENT '開催日時',
    location VARCHAR(255) NULL COMMENT '場所',
    capacity INT NULL COMMENT '定員',
    summary TEXT NULL COMMENT '概要',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    PRIMARY KEY (event_id),
    INDEX idx_event_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='イベントテーブル';

-- ============================================
-- 3. 参加申込テーブル (registrations)
-- ============================================
CREATE TABLE registrations (
    reg_id INT NOT NULL AUTO_INCREMENT COMMENT '申込ID',
    email VARCHAR(255) NOT NULL COMMENT 'メールアドレス',
    event_id INT NOT NULL COMMENT 'イベントID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    PRIMARY KEY (reg_id),
    FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY uk_email_event (email, event_id) COMMENT '同一ユーザーの同一イベントへの重複登録防止',
    INDEX idx_email (email),
    INDEX idx_event_id (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='参加申込テーブル';

-- ============================================
-- 4. 打刻履歴テーブル (attendance_logs)
-- ============================================
CREATE TABLE attendance_logs (
    log_id INT NOT NULL AUTO_INCREMENT COMMENT '打刻ID',
    email VARCHAR(255) NOT NULL COMMENT 'メールアドレス',
    event_id INT NOT NULL COMMENT 'イベントID',
    in_time DATETIME NOT NULL COMMENT '入室時刻',
    out_time DATETIME NULL COMMENT '退室時刻',
    staff_email VARCHAR(255) NOT NULL COMMENT '担当者メアド',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
    PRIMARY KEY (log_id),
    FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (staff_email) REFERENCES users(email) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_email (email),
    INDEX idx_event_id (event_id),
    INDEX idx_staff_email (staff_email),
    INDEX idx_in_time (in_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='打刻履歴テーブル';

-- ============================================
-- 初期データ（オプション）
-- ============================================
-- 管理者ユーザーの作成例
-- INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag) 
-- VALUES ('admin@example.com', 'hashed_password', '管理者', 'カンリシャ', '090-1234-5678', 3);

-- ============================================
-- ビュー定義（レポート用）
-- ============================================
-- 参加者一覧ビュー
CREATE OR REPLACE VIEW v_event_participants AS
SELECT 
    e.event_id,
    e.event_name,
    e.event_date,
    r.email,
    u.name_kanji,
    u.name_kana,
    r.created_at AS registration_date
FROM events e
INNER JOIN registrations r ON e.event_id = r.event_id
INNER JOIN users u ON r.email = u.email;

-- 打刻履歴詳細ビュー
CREATE OR REPLACE VIEW v_attendance_details AS
SELECT 
    al.log_id,
    al.email,
    u.name_kanji AS user_name,
    al.event_id,
    e.event_name,
    e.event_date,
    al.in_time,
    al.out_time,
    TIMESTAMPDIFF(MINUTE, al.in_time, al.out_time) AS stay_minutes,
    al.staff_email,
    staff.name_kanji AS staff_name,
    al.created_at
FROM attendance_logs al
INNER JOIN users u ON al.email = u.email
INNER JOIN events e ON al.event_id = e.event_id
INNER JOIN users staff ON al.staff_email = staff.email;
