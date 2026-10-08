-- 利用規約・プライバシーポリシー同意日時（JST DATETIME）
-- NULL = 未同意。管理者（role_flag=3）以外は同意後にサービス利用可。

ALTER TABLE users
  ADD COLUMN terms_accepted_at DATETIME NULL
    COMMENT '利用規約・プライバシーポリシー同意日時（JST）。NULL=未同意'
    AFTER is_active;
