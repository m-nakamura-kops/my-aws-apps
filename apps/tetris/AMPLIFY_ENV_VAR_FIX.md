# Amplify環境変数の修正ガイド

## 問題

ビルドログに以下のエラーが表示されました：

```
!!! CustomerError: Monorepo spec provided without "applications" key
```

## 原因

`AMPLIFY_MONOREPO_APP_ROOT`環境変数が設定されている場合、Amplifyは`amplify.yml`に`applications`セクションを期待します。しかし、Amplify Hosting（Gen 1）では、この形式はサポートされていません。

## 解決策

### 方法1: 環境変数を削除（推奨）

`AMPLIFY_MONOREPO_APP_ROOT`環境変数を削除し、通常の設定に戻します。

1. Amplifyコンソールで「ホスティング」→「環境変数」を開く
2. `AMPLIFY_MONOREPO_APP_ROOT`を削除
3. `amplify.yml`で`cd apps/tetris`を実行する設定を使用

### 方法2: `applications`セクションを追加

`amplify.yml`に`applications`セクションを追加します（Amplify Gen 2の場合）。

```yaml
version: 1
applications:
  - appRoot: apps/tetris
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

## 推奨設定

Amplify Hosting（Gen 1）を使用している場合、以下の設定を推奨します：

### `amplify.yml`（ルート）

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd apps/tetris
        - npm ci
    build:
      commands:
        - cd apps/tetris
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

### 環境変数

- `AMPLIFY_MONOREPO_APP_ROOT`を**削除**
- `AMPLIFY_DIFF_DEPLOY`: `false`（そのまま）

## 手順

1. **環境変数を削除**
   - Amplifyコンソールで「ホスティング」→「環境変数」を開く
   - `AMPLIFY_MONOREPO_APP_ROOT`を削除

2. **`amplify.yml`を更新**
   - ルートの`amplify.yml`を上記の推奨設定に更新

3. **再デプロイ**
   - 新しいコミットがプッシュされると自動的に再デプロイが開始されます

## 確認事項

- [ ] `AMPLIFY_MONOREPO_APP_ROOT`環境変数が削除されている
- [ ] `amplify.yml`で`cd apps/tetris`が実行されている
- [ ] `baseDirectory`が`apps/tetris/.next`になっている
- [ ] ビルドログでエラーが発生しない
