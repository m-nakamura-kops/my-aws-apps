# フェーズ2: 認証・ユーザー管理 実装ガイド

## 実装完了項目

### フロントエンド
- ✅ Amplify設定 (`src/lib/amplify-config.ts`)
- ✅ 認証コンテキスト (`src/contexts/AuthContext.tsx`)
- ✅ ログイン画面 (`src/app/login/page.tsx`)
- ✅ ユーザー登録画面 (`src/app/register/page.tsx`)
- ✅ APIクライアント (`src/lib/api-client.ts`)
- ✅ ホーム画面の認証保護 (`src/app/page.tsx`)

### バックエンド
- ✅ ログインLambda関数 (`backend/functions/users/login/index.ts`)
- ✅ ユーザー登録Lambda関数 (`backend/functions/users/register/index.ts`)
- ✅ Secrets Manager統合 (`backend/shared/db/secrets.ts`)

### Infrastructure as Code
- ✅ API Gatewayエンドポイント追加 (`infrastructure/cdk/lib/api-stack.ts`)
- ✅ Cognito権限の追加

## 次のステップ: デプロイとテスト

### 1. Lambda関数の依存関係をインストール

```bash
# ログインLambda関数
cd apps/qr-attendance/backend/functions/users/login
npm install

# ユーザー登録Lambda関数
cd ../register
npm install
```

### 2. APIスタックの再デプロイ

```bash
cd apps/qr-attendance/infrastructure/cdk
npm run deploy:api
```

### 3. フロントエンドの動作確認

```bash
cd apps/qr-attendance/frontend
npm install
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスして、ログイン画面にリダイレクトされることを確認してください。

### 4. テスト手順

1. **ユーザー登録**
   - `http://localhost:3000/register` にアクセス
   - フォームに入力して登録
   - 確認メール（開発環境では自動確認）

2. **ログイン**
   - `http://localhost:3000/login` にアクセス
   - 登録したメールアドレスとパスワードでログイン
   - ホーム画面にリダイレクトされることを確認

3. **ログアウト**
   - ホーム画面の「ログアウト」ボタンをクリック
   - ログイン画面にリダイレクトされることを確認

## トラブルシューティング

### Cognito認証エラー

- User Pool IDとClient IDが正しく設定されているか確認
- `.env.local`ファイルの設定を確認

### Lambda関数エラー

- CloudWatch Logsでエラーログを確認
- 環境変数が正しく設定されているか確認
- RDSへの接続が可能か確認（セキュリティグループ設定）

### データベース接続エラー

- Secrets Managerから認証情報が取得できているか確認
- RDSエンドポイントが正しいか確認
- VPC設定とセキュリティグループを確認

## 参考資料

- [API仕様書](./API.md)
- [ロードマップ](./ROADMAP.md)
