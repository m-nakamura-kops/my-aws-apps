# ログイン問題のトラブルシューティング

## 現在の状況

ログインページは表示されますが、ログインに失敗しています。

## 考えられる原因

1. **データベースの初期化が未完了**
   - データベースのマイグレーションは完了しました
   - しかし、シードスクリプト（初期ユーザーの作成）がエラーで実行できていません

2. **ZenStackの生成ファイルの問題**
   - `zenstack generate`は実行しましたが、enhance関数が見つからないエラーが発生

## 解決方法

### 方法1: デバッグログインを使用（推奨）

DEVELOPMENT_SETUP.mdによると、開発環境ではデバッグログインが使用できます：

```
http://localhost:5001/debug/login?email=admin@example.com&password=123456789Aa%23&redirect_to=%2Fadmin
```

このURLに直接アクセスすることで、認証をスキップしてログインできます。

### 方法2: データベースのシードを手動で実行

シードスクリプトがエラーで実行できない場合、以下の手順を試してください：

```bash
cd ~/jp-polaris-app

# 1. ZenStackの再生成
npx zenstack generate

# 2. Prismaクライアントの再生成
npx prisma generate

# 3. 開発サーバーの再起動
npm run kill
npm run dev

# 4. シードスクリプトの実行
npx tsx scripts/admin/seed.ts
```

### 方法3: データベースを直接確認

MySQLに接続してユーザーが存在するか確認：

```bash
# Dockerコンテナ内のMySQLに接続
docker exec -it jp-polaris-app-db-1 mysql -u root -proot polaris

# ユーザーテーブルを確認
SELECT email, name FROM User LIMIT 10;
```

## 次のステップ

1. まず、デバッグログインのURLを試してください
2. それでもログインできない場合は、データベースの状態を確認してください
3. 必要に応じて、データベースをリセットして再初期化してください

## 参考情報

- **デバッグログインURL**: `http://localhost:5001/debug/login?email=admin@example.com&password=123456789Aa%23&redirect_to=%2Fadmin`
- **開発環境セットアップ**: `DEVELOPMENT_SETUP.md`
- **データベースポート**: 3310
- **デフォルトユーザー**: `admin@example.com` / `123456789Aa#`

