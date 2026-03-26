# MySQLパスワードの確認方法

## 方法1: パスワードなしで接続を試す

```bash
mysql -u root
```

パスワードなしで接続できれば、`.env`ファイルの`DB_PASSWORD`は空欄にできます：

```env
DB_PASSWORD=
```

## 方法2: パスワードを入力して接続を試す

```bash
mysql -u root -p
```

パスワードを求められたら、実際のパスワードを入力してください。

## 方法3: パスワードをリセットする

パスワードが分からない場合、以下の手順でリセットできます：

### macOS (Homebrewでインストールした場合)

1. MySQLサービスを停止：
```bash
brew services stop mysql
```

2. MySQLをセーフモードで起動：
```bash
mysqld_safe --skip-grant-tables &
```

3. 別のターミナルでMySQLに接続：
```bash
mysql -u root
```

4. パスワードをリセット：
```sql
USE mysql;
UPDATE user SET authentication_string=PASSWORD('新しいパスワード') WHERE User='root';
FLUSH PRIVILEGES;
EXIT;
```

5. MySQLを再起動：
```bash
brew services restart mysql
```

## .envファイルの設定

`.env`ファイルで`DB_PASSWORD`を設定：

```env
DB_PASSWORD=実際のパスワード
```

パスワードが空の場合は：

```env
DB_PASSWORD=
```

## 確認

設定後、以下のコマンドで接続を確認：

```bash
mysql -u root -p qr_attendance
```

`.env`ファイルのパスワードと同じパスワードで接続できることを確認してください。
