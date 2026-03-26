# ログイン問題の解決ガイド

## 現在の状況

バックエンドサーバーは正常に起動していますが、ログインができません。

## 考えられる原因

1. **MySQLサーバーが起動していない**
2. **データベースにユーザーが存在しない**
3. **パスワードが間違っている**

## 解決手順

### ステップ1: MySQLサーバーを起動

```bash
# MySQLサービスを起動
brew services start mysql

# または
mysql.server start
```

### ステップ2: データベースにユーザーが存在するか確認

```bash
mysql -u root qr_attendance -e "SELECT email, name_kanji, role_flag FROM users;"
```

### ステップ3: ユーザーが存在しない場合、登録する

#### 方法1: 登録ページから登録

1. ブラウザで `http://localhost:3000/register` にアクセス
2. フォームに入力して登録

#### 方法2: MySQLで直接作成

```bash
mysql -u root qr_attendance
```

MySQLプロンプトで：

```sql
-- パスワードをハッシュ化（例: "password123"）
-- SHA256ハッシュを計算する必要があります

-- 簡単な方法: Node.jsでハッシュを計算
-- ターミナルで:
node -e "const crypto = require('crypto'); console.log(crypto.createHash('sha256').update('password123').digest('hex'));"

-- その後、MySQLで:
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag)
VALUES ('test@example.com', 'ハッシュ化されたパスワード', 'テスト', 'テスト', '090-1234-5678', 1);
```

#### 方法3: 登録APIを使用

```bash
curl -X POST http://localhost:3001/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name_kanji": "テスト",
    "name_kana": "テスト",
    "tel": "090-1234-5678"
  }'
```

### ステップ4: ログインを試す

登録後、以下の情報でログイン：

- **メールアドレス**: 登録時に使用したメールアドレス
- **パスワード**: 登録時に使用したパスワード

## トラブルシューティング

### エラー: `ERROR 2002 (HY000): Can't connect to local MySQL server`

**原因**: MySQLサーバーが起動していない

**解決方法**:
```bash
brew services start mysql
```

### エラー: `Invalid email or password`

**原因**: 
- ユーザーがデータベースに存在しない
- パスワードが間違っている

**解決方法**:
1. データベースにユーザーが存在するか確認
2. 正しいパスワードでログインを試す
3. パスワードを忘れた場合、新しいユーザーを登録する

### エラー: `DB_SECRET_ARN environment variable is not set`

**解決済み**: このエラーは既に修正されています。バックエンドサーバーを再起動してください。

## 確認コマンド

```bash
# MySQLサーバーの状態確認
brew services list | grep mysql

# データベースに接続
mysql -u root qr_attendance

# ユーザー一覧を表示
SELECT email, name_kanji, role_flag FROM users;
```
