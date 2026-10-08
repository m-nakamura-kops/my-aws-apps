# パスワード確認ガイド

## パスワードが一致しない場合の確認方法

### ステップ1: データベースに保存されているパスワードハッシュを確認

MySQLプロンプトで：

```sql
SELECT email, password, name_kanji FROM users WHERE email = 'nkmr1201@gmail.com';
```

### ステップ2: ログイン時に使用しているパスワードをハッシュ化

ターミナルで：

```bash
node -e "const crypto = require('crypto'); console.log(crypto.createHash('sha256').update('あなたのパスワード').digest('hex'));"
```

### ステップ3: ハッシュを比較

データベースに保存されている`password`フィールドの値と、ステップ2で計算したハッシュが一致するか確認してください。

## パスワードをリセットする方法

### 方法1: 新しいパスワードで更新

MySQLプロンプトで：

```sql
-- 新しいパスワードのハッシュを計算（例: "newpassword123"）
-- ターミナルで:
node -e "const crypto = require('crypto'); console.log(crypto.createHash('sha256').update('newpassword123').digest('hex'));"

-- その後、MySQLで:
UPDATE users 
SET password = '計算されたハッシュ値' 
WHERE email = 'nkmr1201@gmail.com';
```

### 方法2: 登録APIを使用して再登録

```bash
curl -X POST http://localhost:3001/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nkmr1201@gmail.com",
    "password": "新しいパスワード",
    "name_kanji": "中村雅宏",
    "name_kana": "ナカムラマサヒロ",
    "tel": "07014052255"
  }'
```

注意: 既存のユーザーでも、`ON DUPLICATE KEY UPDATE`により更新されます。

## 簡単なテストユーザーを作成

```bash
# パスワード「password123」のハッシュを計算
node -e "const crypto = require('crypto'); console.log(crypto.createHash('sha256').update('password123').digest('hex'));"
```

MySQLプロンプトで：

```sql
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag)
VALUES ('test@example.com', '計算されたハッシュ値', 'テスト', 'テスト', '090-1234-5678', 1);
```

その後、`test@example.com` / `password123` でログインできます。
