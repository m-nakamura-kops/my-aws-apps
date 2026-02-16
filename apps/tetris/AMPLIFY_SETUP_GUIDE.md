# AWS Amplify Gen 2 セットアップガイド（実際の画面に基づく）

## 📋 ステップ3: アプリケーションの設定

### 現在の自動検出設定

Amplifyが自動的にNext.jsを検出し、以下の設定が自動入力されています：

- **フロントエンドビルドコマンド**: `npm run build`
- **出力ディレクトリをビルド**: `apps/tetris/.next`

### ✅ 確認・修正が必要な項目

#### 1. フロントエンドビルドコマンド

**現在の設定**: `npm run build`

**修正が必要な場合**:
monorepoの場合、ルートディレクトリが`apps/tetris`に設定されているので、このコマンドは`apps/tetris`ディレクトリ内で実行されます。そのため、現在の設定で問題ありません。

もしエラーが出る場合は、以下に変更：
```
cd apps/tetris && npm run build
```

#### 2. 出力ディレクトリをビルド

**現在の設定**: `apps/tetris/.next`

**確認**: 
この設定は正しいです。Next.jsのビルド出力は`.next`ディレクトリに生成されます。

#### 3. amplify.ymlファイルについて

**重要**: `amplify.yml`ファイルは、Amplifyが自動的に検出します。

- ルートディレクトリ（`apps/tetris`）に`amplify.yml`がある場合、自動的に使用されます
- または、「YML ファイルを編集」ボタンをクリックして、`amplify.yml`の内容を確認・編集できます

**現在のamplify.ymlの場所**:
- リポジトリのルート: `/amplify.yml`
- ルートディレクトリが`apps/tetris`の場合、`apps/tetris/amplify.yml`を探します

**対応方法**:
1. `amplify.yml`を`apps/tetris/`ディレクトリにコピーする
2. または、「YML ファイルを編集」ボタンで直接設定を入力する

### 🔧 amplify.ymlをapps/tetrisにコピー

monorepoの場合、ルートディレクトリが`apps/tetris`に設定されているので、`amplify.yml`もそのディレクトリに配置する必要があります。

```bash
# amplify.ymlをapps/tetrisにコピー
cp amplify.yml apps/tetris/amplify.yml
```

ただし、`amplify.yml`の内容も修正が必要です（`cd apps/tetris`の部分を削除）。

### 📝 推奨設定

**「YML ファイルを編集」ボタンをクリックして、以下の内容を設定**:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

**注意**: ルートディレクトリが`apps/tetris`に設定されている場合、この設定は`apps/tetris`ディレクトリ内で実行されます。

### ✅ 次のステップ

1. **「YML ファイルを編集」をクリック**
   - 上記のYML設定を入力（または現在の設定を確認）

2. **サービスロール**
   - 「新しいサービスロールを作成して使用」を選択（推奨）

3. **「次へ」をクリック**
   - 確認画面に進みます

4. **デプロイ実行**
   - 「保存してデプロイ」をクリック

## 🐛 トラブルシューティング

### ビルドエラーが発生する場合

1. **「YML ファイルを編集」で設定を確認**
   - ビルドコマンドが正しいか確認
   - パスが正しいか確認

2. **ビルドログを確認**
   - デプロイ後、ビルドログでエラーを確認

3. **ローカルでビルド確認**
   ```bash
   cd apps/tetris
   npm run build
   ```
