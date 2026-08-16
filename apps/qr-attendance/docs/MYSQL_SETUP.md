# MySQLセットアップガイド（macOS）

## 問題

`mysql: command not found` エラーが発生しています。

## 解決方法

### 方法1: HomebrewでMySQLをインストール（推奨）

```bash
# Homebrewがインストールされているか確認
brew --version

# MySQLをインストール
brew install mysql

# MySQLを起動
brew services start mysql

# MySQLコマンドが使用可能か確認
mysql --version
```

### 方法2: MySQLのパスを確認して追加

MySQLがインストールされているが、PATHに含まれていない場合：

```bash
# MySQLの場所を探す
find /usr/local -name mysql 2>/dev/null | head -5
find /opt/homebrew -name mysql 2>/dev/null | head -5

# 見つかったパスをPATHに追加（一時的）
export PATH="/usr/local/mysql/bin:$PATH"
# または
export PATH="/opt/homebrew/bin:$PATH"

# 確認
mysql --version
```

### 方法3: フルパスで実行

MySQLのインストール場所が分かっている場合：

```bash
# Homebrewでインストールした場合
/opt/homebrew/bin/mysql -u root -p qr_attendance

# または
/usr/local/bin/mysql -u root -p qr_attendance
```

## MySQLのインストール確認

### インストールされているか確認

```bash
# Homebrewで確認
brew list mysql

# または、直接確認
ls -la /opt/homebrew/bin/mysql
ls -la /usr/local/bin/mysql
```

### MySQLの起動確認

```bash
# MySQLサービスの状態確認
brew services list | grep mysql

# MySQLを起動
brew services start mysql

# または、手動で起動
mysql.server start
```

## データベースへの接続

MySQLがインストール・起動されたら：

```bash
# 接続
mysql -u root -p qr_attendance

# または、フルパスで実行
/opt/homebrew/bin/mysql -u root -p qr_attendance
```

## テストユーザーの作成

MySQLに接続後：

```sql
-- 管理者ユーザーを作成（パスワード: admin123）
INSERT INTO users (email, password, name_kanji, name_kana, tel, role_flag) 
VALUES (
  'admin@example.com', 
  SHA2('admin123', 256),
  '管理者', 
  'カンリシャ', 
  '090-1234-5678', 
  3
);

-- 既存のユーザーのパスワードを設定
UPDATE users 
SET password = SHA2('Nakamura1201', 256) 
WHERE email = 'nkmr1201@gmail.com';

-- 確認
SELECT email, name_kanji, role_flag FROM users;
EXIT;
```

## 代替方法: ユーザー登録APIを使用

MySQLコマンドが使用できない場合、フロントエンドの登録画面からユーザーを作成できます：

1. ブラウザで `http://localhost:3000/register` にアクセス
2. フォームに入力して登録

**注意**: 登録APIもCognitoを使用している場合は、同様の修正が必要です。

## トラブルシューティング

### Homebrewがインストールされていない場合

```bash
# Homebrewをインストール
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# その後、MySQLをインストール
brew install mysql
```

### ポート3306が既に使用されている場合

```bash
# 使用しているプロセスを確認
lsof -i :3306

# MySQLが既に起動している可能性があります
```

### パスワードを忘れた場合

```bash
# MySQLをセーフモードで起動（パスワードなしでログイン）
mysqld_safe --skip-grant-tables &

# 別のターミナルで接続
mysql -u root

# パスワードをリセット
ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
EXIT;
```
