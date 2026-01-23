# AWS Amplify Gen 2 デプロイガイド

## 📋 デプロイ前の準備

### 1. ビルド確認

```bash
cd apps/tetris
npm run build
```

ビルドが成功することを確認してください。

### 2. ルートディレクトリの確認

このプロジェクトはmonorepo構造のため、ルートディレクトリに`amplify.yml`を配置しています。

## 🚀 AWS Amplify Gen 2でのデプロイ手順

### ステップ1: AWS Amplifyコンソールでアプリを作成

1. [AWS Amplify Console](https://console.aws.amazon.com/amplify/)にアクセス
2. 「新しいアプリ」→「GitHubからホスト」を選択
3. GitHubリポジトリ（`m-nakamura-kops/my-aws-apps`）を選択
4. ブランチ（`main`）を選択

### ステップ2: ビルド設定

Amplifyコンソールで以下の設定を確認・入力：

**アプリ設定:**
- **アプリ名**: `tetris-app`（任意）
- **環境**: `main`

**ビルド設定:**
- **ビルド設定ファイル**: `amplify.yml`（ルートディレクトリに配置済み）

**環境変数（必要に応じて）:**
- 現在は不要（DynamoDB連携時に追加）

### ステップ3: デプロイ実行

1. 「保存してデプロイ」をクリック
2. ビルドログを確認
3. デプロイ完了後、提供されるURLでアクセス

## 📝 amplify.ymlの説明

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd apps/tetris      # tetrisアプリのディレクトリに移動
        - npm ci              # 依存関係をインストール
    build:
      commands:
        - npm run build        # Next.jsアプリをビルド
  artifacts:
    baseDirectory: apps/tetris/.next  # ビルド成果物のディレクトリ
    files:
      - '**/*'                # すべてのファイルを含める
  cache:
    paths:
      - apps/tetris/node_modules/**/*  # node_modulesをキャッシュ
      - apps/tetris/.next/cache/**/*    # Next.jsキャッシュをキャッシュ
```

## 🔧 トラブルシューティング

### ビルドエラーが発生する場合

1. **Node.jsバージョンの確認**
   - AmplifyコンソールでNode.jsバージョンを18.x以上に設定

2. **ビルドログの確認**
   - Amplifyコンソールの「ビルドログ」タブでエラーを確認

3. **ローカルでのビルド確認**
   ```bash
   cd apps/tetris
   npm run build
   ```

### 404エラーが発生する場合

Next.jsのApp Routerを使用している場合、`next.config.ts`で適切な設定が必要です。

### PWAが動作しない場合

- HTTPSでアクセスしていることを確認（PWAはHTTPS必須）
- manifest.jsonが正しく配信されているか確認
- Service Workerの設定を確認（必要に応じて追加）

## 📱 デプロイ後の確認事項

- [ ] アプリが正常に表示される
- [ ] ゲームが正常に動作する
- [ ] PWAとして「ホーム画面に追加」ができる（HTTPS環境で）
- [ ] スマホ画面でスクロールなしで表示される
- [ ] すべてのボタンが正常に動作する

## 🔗 次のステップ（オプション）

### DynamoDB連携

1. Amplify Gen 2でDynamoDBテーブルを作成
2. `src/app/api/score/route.ts`を完成させる
3. 環境変数を設定

### カスタムドメイン設定

1. Amplifyコンソールで「ドメイン管理」を開く
2. カスタムドメインを追加
3. DNS設定を完了

## 📚 参考資料

- [AWS Amplify Gen 2 Documentation](https://docs.amplify.aws/gen2/)
- [Next.js on AWS Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/deploy-nextjs-app.html)
- [Amplify Build Settings](https://docs.aws.amazon.com/amplify/latest/userguide/build-settings.html)
