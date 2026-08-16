-- ============================================
-- 結合テスト用 検証データ作成スクリプト
-- ============================================
-- 管理者・スタッフ・利用者の3パターンのテストユーザーを作成します。
-- パスワードはすべて「TestPass12」（8文字以上）。MySQLのSHA2でハッシュしています。
--
-- 実行例:
--   mysql -u root -p qr_attendance < database/seed-test-users.sql
-- または MySQLクライアントで:
--   USE qr_attendance;
--   SOURCE /path/to/seed-test-users.sql;
-- ============================================

-- 既存のテストユーザーがいる場合は削除してから挿入（冪等にするため）
DELETE FROM users WHERE email IN (
  'it-admin@example.com',
  'it-staff@example.com',
  'it-user@example.com',
  'it-dup@example.com'
);

-- 管理者（role_flag = 3）
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag, remarks)
VALUES (
  'it-admin@example.com',
  SHA2('TestPass12', 256),
  '結合テスト管理者',
  'ケツゴウテストカンリシャ',
  '090-0000-0001',
  3,
  '結合テスト用管理者アカウント'
);

-- スタッフ（role_flag = 2）
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag, remarks)
VALUES (
  'it-staff@example.com',
  SHA2('TestPass12', 256),
  '結合テストスタッフ',
  'ケツゴウテストスタッフ',
  '090-0000-0002',
  2,
  '結合テスト用スタッフアカウント'
);

-- 利用者（role_flag = 1）
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag, remarks)
VALUES (
  'it-user@example.com',
  SHA2('TestPass12', 256),
  '結合テスト利用者',
  'ケツゴウテストリヨウシャ',
  '090-0000-0003',
  1,
  '結合テスト用利用者アカウント'
);

-- 利用者登録テスト 1.2.3 重複登録用（既存メールで登録→400確認用）
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag, remarks)
VALUES (
  'it-dup@example.com',
  SHA2('TestPass12', 256),
  '重複登録テスト用',
  'チョウフクトウロクテストヨウ',
  '090-0000-0004',
  1,
  '1.2.3 重複登録テスト用・このメールで再度登録して400を確認'
);

-- 確認用
SELECT email, name_kanji, role_flag,
  CASE role_flag
    WHEN 1 THEN '利用者'
    WHEN 2 THEN 'スタッフ'
    WHEN 3 THEN '管理者'
    ELSE '-'
  END AS role_name
FROM users
WHERE email IN ('it-admin@example.com', 'it-staff@example.com', 'it-user@example.com', 'it-dup@example.com')
ORDER BY role_flag DESC;
