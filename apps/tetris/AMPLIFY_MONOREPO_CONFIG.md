# Amplify Monorepo設定の説明

## 重要な環境変数

Amplifyコンソールで以下の環境変数が設定されています：

- `AMPLIFY_MONOREPO_APP_ROOT`: `apps/tetris`
- `AMPLIFY_DIFF_DEPLOY`: `false`

## `AMPLIFY_MONOREPO_APP_ROOT`の動作

`AMPLIFY_MONOREPO_APP_ROOT`が設定されている場合、Amplifyは**自動的にそのディレクトリでコマンドを実行**します。

つまり：
- ✅ `AMPLIFY_MONOREPO_APP_ROOT`が設定されている場合、`cd apps/tetris`は**不要**
- ✅ `baseDirectory`は`.next`（`apps/tetris`からの相対パス）
- ✅ `cache`のパスも`apps/tetris/`プレフィックスは不要

## 現在の設定

### ルートの`amplify.yml`
- `AMPLIFY_MONOREPO_APP_ROOT`が設定されていない場合に備えて、条件分岐を追加
- 環境変数が設定されている場合は`cd`をスキップ

### `apps/tetris/amplify.yml`
- `AMPLIFY_MONOREPO_APP_ROOT`が設定されている場合に使用される設定
- 相対パスを使用（`cd`不要）

## 推奨設定

`AMPLIFY_MONOREPO_APP_ROOT`が`apps/tetris`に設定されている場合、以下の設定が推奨されます：

### ルートの`amplify.yml`（フォールバック用）
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - |
          if [ -z "$AMPLIFY_MONOREPO_APP_ROOT" ]; then
            cd apps/tetris
          fi
        - npm ci
    build:
      commands:
        - |
          if [ -z "$AMPLIFY_MONOREPO_APP_ROOT" ]; then
            cd apps/tetris
          fi
        - npm run build
  artifacts:
    baseDirectory: apps/tetris/.next
    files:
      - '**/*'
  cache:
    paths:
      - apps/tetris/node_modules/**/*
      - apps/tetris/.next/cache/**/*
```

### `apps/tetris/amplify.yml`（推奨）
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

## トラブルシューティング

### ビルドが失敗する場合

1. **環境変数の確認**
   - Amplifyコンソールで`AMPLIFY_MONOREPO_APP_ROOT`が`apps/tetris`に設定されているか確認

2. **ビルドログの確認**
   - 「Current directory:」と「Working directory:」の出力を確認
   - `apps/tetris`ディレクトリにいることを確認

3. **`baseDirectory`の確認**
   - `AMPLIFY_MONOREPO_APP_ROOT`が設定されている場合：`.next`
   - 設定されていない場合：`apps/tetris/.next`

## 参考資料

- [AWS Amplify Monorepo Documentation](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html)
