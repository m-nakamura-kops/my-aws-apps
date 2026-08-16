# Cognito clientIdエラーの解決方法

## エラー

```
InvalidParameterException: Value null at 'clientId' failed to satisfy constraint: Member must not be null
```

## 原因

ログインLambda関数がCognitoを使用しようとしていますが、ローカル開発環境ではCognito設定が空のためエラーが発生しています。

## 解決方法

### 修正済み

ログインLambda関数を修正して、Cognito設定がない場合はデータベース認証のみを使用するようにしました。

### 次のステップ

1. **Lambda関数を再ビルド**（既に実行済み）

2. **バックエンドサーバーを再起動**

   現在実行中のバックエンドサーバーを停止（Ctrl+C）して、再度起動：

   ```bash
   cd /Users/masahiro/MySelector/apps/qr-attendance/backend
   npm run dev
   ```

3. **テストユーザーを作成**

   データベースにユーザーが存在しない場合、作成する必要があります：

   ```bash
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
   ```

4. **ログインを再試行**

   - ブラウザで `http://localhost:3000/login` をリロード
   - メールアドレス: `admin@example.com`
   - パスワード: `admin123`
   - 「ログイン」ボタンをクリック

## 動作確認

バックエンドサーバーのログを確認：

- Cognito設定がない場合: `useCognito = false` となり、データベース認証が使用されます
- エラーメッセージが表示されなくなれば成功です

## トラブルシューティング

### まだエラーが出る場合

1. Lambda関数が再ビルドされているか確認：
   ```bash
   ls -la /Users/masahiro/MySelector/apps/qr-attendance/backend/functions/users/login/index.js
   ```

2. バックエンドサーバーを再起動

3. データベースにユーザーが存在するか確認：
   ```sql
   SELECT email, name_kanji FROM users;
   ```
