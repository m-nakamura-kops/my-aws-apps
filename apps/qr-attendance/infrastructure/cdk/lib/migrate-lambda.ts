/**
 * データベーススキーマ適用用Lambda関数のコード
 */
export const migrateLambdaCode = `
const mysql = require('mysql2/promise');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION });

async function getDbCredentials() {
  const secretArn = process.env.DB_SECRET_ARN;
  const response = await secretsManager.send(new GetSecretValueCommand({ SecretId: secretArn }));
  return JSON.parse(response.SecretString);
}

exports.handler = async (event) => {
  console.log('Starting database migration...');
  
  let connection;
  try {
    // データベース認証情報を取得
    const credentials = await getDbCredentials();
    const dbName = process.env.DB_NAME || 'qr_attendance';
    
    // データベース接続
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: credentials.username,
      password: credentials.password,
      database: dbName,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      multipleStatements: true, // 複数SQL文の実行を許可
    });
    
    console.log('Connected to database');
    
    // スキーマSQLを実行
    const schemaSQL = \`
-- ============================================
-- 1. ユーザーテーブル (users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
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
CREATE TABLE IF NOT EXISTS events (
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
CREATE TABLE IF NOT EXISTS registrations (
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
CREATE TABLE IF NOT EXISTS attendance_logs (
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
\`;
    
    // SQLを実行
    await connection.query(schemaSQL);
    console.log('Schema migration completed successfully');
    
    // テーブル一覧を確認
    const [tables] = await connection.query('SHOW TABLES');
    console.log('Tables created:', tables);
    
    await connection.end();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Database schema migration completed successfully',
        tables: tables,
      }),
    };
  } catch (error) {
    console.error('Migration error:', error);
    if (connection) {
      await connection.end();
    }
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Migration failed',
        message: error.message,
        stack: error.stack,
      }),
    };
  }
};
`;
