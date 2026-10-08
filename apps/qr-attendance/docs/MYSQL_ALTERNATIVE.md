# MySQLがインストールされていない場合の対処法

## 問題

`mysql: command not found` エラーが発生しています。

## 解決方法

### 方法1: MySQLをインストール（推奨）

#### Homebrewでインストール

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

#### インストール後のセットアップ

```bash
# データベース作成
mysql -u root -p
CREATE DATABASE qr_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# スキーマ適用
cd /Users/masahiro/MySelector/apps/qr-attendance/database
mysql -u root -p qr_attendance < schema.sql

# テストユーザー作成
mysql -u root -p qr_attendance
```

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
EXIT;
```

### 方法2: ユーザー登録APIを使用（MySQL不要）

MySQLがインストールされていない場合でも、フロントエンドの登録画面からユーザーを作成できます。

#### ステップ1: ユーザー登録Lambda関数をビルド

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend/functions/users/register
npm install
npm run build
```

#### ステップ2: バックエンドサーバーを再起動

バックエンドサーバーを停止（Ctrl+C）して、再度起動：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev
```

#### ステップ3: フロントエンドからユーザー登録

1. ブラウザで `http://localhost:3000/register` にアクセス
2. フォームに入力：
   - メールアドレス: `admin@example.com`
   - パスワード: `admin123`（8文字以上）
   - 氏名（漢字）: `管理者`
   - カナ: `カンリシャ`
   - 電話番号: `090-1234-5678`
3. 「登録」ボタンをクリック

**注意**: データベースが作成されていない場合は、先にMySQLをインストールしてデータベースを作成する必要があります。

### 方法3: 管理者ユーザーをAPIで作成

curlコマンドで直接APIを呼び出す：

```bash
# まず、データベースとスキーマが作成されている必要があります
# MySQLをインストールして、データベースを作成してください

# ユーザー登録APIを呼び出し
curl -X POST http://localhost:3001/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123",
    "name_kanji": "管理者",
    "name_kana": "カンリシャ",
    "tel": "090-1234-5678"
  }'
```

その後、管理者権限を付与：

```bash
# MySQLで管理者権限を付与（MySQLがインストールされた後）
mysql -u root -p qr_attendance
```

```sql
UPDATE users SET role_flag = 3 WHERE email = 'admin@example.com';
EXIT;
```

## 推奨手順

1. **MySQLをインストール**（最も確実な方法）
2. **データベースとスキーマを作成**
3. **テストユーザーを作成**
4. **ログインを試す**

## トラブルシューティング

### Homebrewがインストールされていない場合

```bash
# Homebrewをインストール
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# その後、MySQLをインストール
brew install mysql
```

### MySQLのインストールに時間がかかる場合

MySQLのインストールには数分かかることがあります。完了まで待ってください。

### データベース接続エラー

MySQLをインストールした後、`.env`ファイルの設定を確認：

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
cat .env
```

以下が設定されていることを確認：
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=あなたのMySQLパスワード
DB_NAME=qr_attendance
DB_SSL=false
```
