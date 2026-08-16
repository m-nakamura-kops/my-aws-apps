-- 退会処理の厳格化 (6.4.13): ステータス（有効/退会）用カラム追加
-- is_active: 1=有効, 0=退会。退会ユーザーはログイン・新規申込を拒否する。

ALTER TABLE users
  ADD COLUMN is_active TINYINT NOT NULL DEFAULT 1
    COMMENT '有効=1, 退会=0。0の場合はログイン・新規申込不可'
    AFTER role_flag;

CREATE INDEX idx_users_is_active ON users (is_active);
