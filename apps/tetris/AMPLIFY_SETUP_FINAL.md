# Amplify設定の最終確認ガイド

## 重要なポイント

`AMPLIFY_MONOREPO_APP_ROOT`が`apps/tetris`に設定されている場合、Amplifyは**自動的にそのディレクトリでコマンドを実行**します。

## 正しい`amplify.yml`の設定

### ルートの`amplify.yml`（推奨設定）

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - echo "Current directory:" && pwd
        - echo "AMPLIFY_MONOREPO_APP_ROOT: $AMPLIFY_MONOREPO_APP_ROOT"
        - echo "Node version:" && node --version
        - echo "NPM version:" && npm --version
        - |
          if [ -z "$AMPLIFY_MONOREPO_APP_ROOT" ]; then
            echo "AMPLIFY_MONOREPO_APP_ROOT not set, changing to apps/tetris"
            cd apps/tetris
          else
            echo "AMPLIFY_MONOREPO_APP_ROOT is set, already in correct directory"
          fi
        - echo "Working directory:" && pwd
        - echo "Installing dependencies..."
        - npm ci
    build:
      commands:
        - |
          if [ -z "$AMPLIFY_MONOREPO_APP_ROOT" ]; then
            echo "AMPLIFY_MONOREPO_APP_ROOT not set, changing to apps/tetris"
            cd apps/tetris
          else
            echo "AMPLIFY_MONOREPO_APP_ROOT is set, already in correct directory"
          fi
        - echo "Building Next.js app..."
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

## Amplifyコンソールでの設定方法

### 1. ビルド設定の更新

1. Amplifyコンソールで「ホスティング」→「ビルドの設定」を開く
2. 「編集」ボタンをクリック
3. 上記の`amplify.yml`の内容をコピー＆ペースト
4. 「保存」をクリック

### 2. 環境変数の確認

「ホスティング」→「環境変数」で以下を確認：

- `AMPLIFY_MONOREPO_APP_ROOT`: `apps/tetris`
- `AMPLIFY_DIFF_DEPLOY`: `false`

### 3. よくある間違い

❌ **間違い**: `cd apps/tetris`を複数回実行
```yaml
preBuild:
  commands:
    - cd apps/tetris  # 不要
    - cd apps/tetris  # 重複
```

✅ **正しい**: `AMPLIFY_MONOREPO_APP_ROOT`が設定されている場合、`cd`は不要

❌ **間違い**: `baseDirectory`が重複
```yaml
artifacts:
  baseDirectory: apps/tetris/.next  # 間違い
  baseDirectory: .next              # 重複
```

✅ **正しい**: `AMPLIFY_MONOREPO_APP_ROOT`が設定されている場合、`.next`（相対パス）

❌ **間違い**: `cache`のパスが重複
```yaml
cache:
  paths:
    - apps/tetris/node_modules/**/*  # 間違い
    - node_modules/**/*              # 重複
```

✅ **正しい**: `AMPLIFY_MONOREPO_APP_ROOT`が設定されている場合、相対パス

## ビルドログの確認ポイント

ビルドログで以下を確認：

1. **Current directory**: リポジトリのルート（例: `/codebuild/output/src123`）
2. **AMPLIFY_MONOREPO_APP_ROOT**: `apps/tetris`が表示される
3. **Working directory**: `apps/tetris`ディレクトリにいることを確認
4. **npm ci**: 依存関係のインストールが成功することを確認
5. **npm run build**: Next.jsのビルドが成功することを確認

## トラブルシューティング

### エラー: "npm ci failed"

**原因**: `package-lock.json`が見つからない、またはディレクトリが間違っている

**対処法**:
- ビルドログで「Working directory:」を確認
- `apps/tetris`ディレクトリにいることを確認

### エラー: "Build failed"

**原因**: Next.jsのビルドが失敗している

**対処法**:
- ビルドログで具体的なエラーメッセージを確認
- ローカルで`cd apps/tetris && npm run build`を実行してエラーを再現

### エラー: "Artifacts not found"

**原因**: `baseDirectory`のパスが間違っている

**対処法**:
- `AMPLIFY_MONOREPO_APP_ROOT`が設定されている場合、`baseDirectory`は`.next`（相対パス）
- 設定されていない場合、`apps/tetris/.next`

## 確認事項チェックリスト

- [ ] `AMPLIFY_MONOREPO_APP_ROOT`が`apps/tetris`に設定されている
- [ ] `amplify.yml`に重複がない
- [ ] `baseDirectory`が`.next`（相対パス）になっている
- [ ] `cache`のパスが相対パスになっている
- [ ] ビルドログで「Working directory:」が`apps/tetris`になっている
