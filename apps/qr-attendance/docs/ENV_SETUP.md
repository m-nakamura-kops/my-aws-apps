# 環境変数の設定ガイド

## バックエンド環境変数の設定

### `.env`ファイルの作成

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
cp .env.example .env
```

### `.env`ファイルの編集

`.env`ファイルを開いて、以下の値を実際の値に変更してください：

```env
# データベース設定
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=あなたのMySQLパスワード  # ← ここを変更！
DB_NAME=qr_attendance
DB_SSL=false

# AWS Cognito設定（ローカル開発時は空欄でも可）
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
AWS_REGION=ap-northeast-1

# API設定
API_BASE_URL=http://localhost:3001
NODE_ENV=development
```

## 重要なポイント

### `DB_PASSWORD`の設定

`.env.example`には`your_password_here`というプレースホルダーが設定されていますが、**実際のMySQLのrootパスワードに変更する必要があります**。

MySQLのパスワードを確認する方法：

```bash
# MySQLに接続してパスワードを確認
mysql -u root -p
```

パスワードを忘れた場合：

1. MySQLを再起動してパスワードをリセット
2. または、新しいパスワードを設定

```bash
# MySQLに接続後
ALTER USER 'root'@'localhost' IDENTIFIED BY '新しいパスワード';
```

### 環境変数の確認

設定が正しいか確認：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
cat .env | grep DB_PASSWORD
```

正しく設定されていれば、実際のパスワードが表示されます（`your_password_here`ではない）。

## トラブルシューティング

### エラー: `Access denied for user 'root'@'localhost'`

**原因**: `DB_PASSWORD`が間違っている、またはMySQLのパスワードが設定されていない

**解決方法**:
1. `.env`ファイルの`DB_PASSWORD`を確認
2. MySQLに直接接続してパスワードを確認：
   ```bash
   mysql -u root -p
   ```

### エラー: `ER_ACCESS_DENIED_ERROR`

**原因**: データベースユーザーの権限が不足している

**解決方法**:
```sql
-- MySQLに接続後
GRANT ALL PRIVILEGES ON qr_attendance.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
```

### エラー: `Unknown database 'qr_attendance'`

**原因**: データベースが作成されていない

**解決方法**:
```bash
mysql -u root -p
CREATE DATABASE qr_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

cd /Users/masahiro/MySelector/apps/qr-attendance/database
mysql -u root -p qr_attendance < schema.sql
```
