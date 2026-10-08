# クイック修正ガイド

## 現在の問題

1. `.env`ファイルの`DB_PASSWORD`が`your_password_here`のまま
2. MySQLサーバーが起動していない可能性

## 解決手順

### ステップ1: MySQLを起動

```bash
# Homebrewでインストールした場合
brew services start mysql

# または、手動で起動
mysql.server start
```

### ステップ2: MySQLに接続してパスワードを確認

```bash
# パスワードなしで試す
mysql -u root

# パスワードが必要な場合
mysql -u root -p
```

### ステップ3: `.env`ファイルを編集

`nano`エディタで開いている場合：

1. `DB_PASSWORD=your_password_here`の行を見つける
2. `your_password_here`を実際のMySQLパスワードに変更
   - パスワードがない場合は空欄: `DB_PASSWORD=`
   - パスワードがある場合は: `DB_PASSWORD=実際のパスワード`
3. `Ctrl+O`で保存、`Enter`で確認、`Ctrl+X`で終了

### ステップ4: 古いバックエンドプロセスを停止

```bash
lsof -ti:3001 | xargs kill -9
```

### ステップ5: バックエンドサーバーを再起動

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev
```

### ステップ6: 登録ページをリロード

ブラウザで`http://localhost:3000/register`をリロードして、再度登録を試してください。

## パスワードが分からない場合

MySQLのパスワードをリセットするか、新しく設定してください：

```bash
# MySQLサービスを停止
brew services stop mysql

# セーフモードで起動（別のターミナルで）
mysqld_safe --skip-grant-tables &

# 別のターミナルでMySQLに接続
mysql -u root

# MySQL内でパスワードを設定
ALTER USER 'root'@'localhost' IDENTIFIED BY '新しいパスワード';
FLUSH PRIVILEGES;
EXIT;

# MySQLを再起動
brew services restart mysql
```

その後、`.env`ファイルの`DB_PASSWORD`を新しいパスワードに設定してください。
