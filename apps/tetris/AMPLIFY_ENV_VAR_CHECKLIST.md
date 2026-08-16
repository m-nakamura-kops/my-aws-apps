# Amplify環境変数削除チェックリスト

## エラー

```
!!! CustomerError: Monorepo spec provided without "applications" key
```

このエラーは、`AMPLIFY_MONOREPO_APP_ROOT`環境変数が設定されているが、`amplify.yml`に`applications`キーがない場合に発生します。

## 確認手順

### 1. 環境変数の確認（全ブランチ）

**重要**: 環境変数は「すべてのブランチ」と「個別のブランチ」の両方で設定されている可能性があります。

#### 手順A: すべてのブランチの環境変数

1. Amplifyコンソールで「my-aws-apps」アプリを選択
2. 「ホスティング」→「環境変数」を開く
3. テーブルを確認：
   - 「ブランチ」列で「すべてのブランチ」を確認
   - `AMPLIFY_MONOREPO_APP_ROOT`が表示されているか確認
   - **表示されている場合は削除**

#### 手順B: 個別ブランチの環境変数

1. 「環境変数」画面で、テーブルをスクロール
2. 「ブランチ」列で「main」やその他のブランチ名を確認
3. `AMPLIFY_MONOREPO_APP_ROOT`が設定されているブランチを確認
4. **設定されている場合は削除**

### 2. ブランチ設定の確認

1. 「アプリ設定」→「ブランチ設定」を開く
2. 「main」ブランチを選択
3. 「環境変数」セクションを確認
4. `AMPLIFY_MONOREPO_APP_ROOT`が設定されている場合は削除

### 3. アプリ設定の確認

1. 「アプリ設定」→「全般設定」を開く
2. 「環境変数」セクションがあるか確認
3. `AMPLIFY_MONOREPO_APP_ROOT`が設定されている場合は削除

## 削除方法

### 方法1: 環境変数画面から削除

1. 「ホスティング」→「環境変数」を開く
2. `AMPLIFY_MONOREPO_APP_ROOT`の行を見つける
3. 右側の「削除」ボタン（ゴミ箱アイコン）をクリック
4. 確認ダイアログで「削除」をクリック

### 方法2: 変数管理画面から削除

1. 「環境変数」画面で「変数を管理」ボタンをクリック
2. `AMPLIFY_MONOREPO_APP_ROOT`を選択
3. 「削除」をクリック
4. 確認ダイアログで「削除」をクリック

## 削除後の確認

環境変数を削除した後、以下を確認：

- [ ] 「環境変数」画面で`AMPLIFY_MONOREPO_APP_ROOT`が表示されていない
- [ ] 「ブランチ設定」で`AMPLIFY_MONOREPO_APP_ROOT`が設定されていない
- [ ] 残っている環境変数は`AMPLIFY_DIFF_DEPLOY`のみ

## 再デプロイ

環境変数を削除すると、Amplifyが自動的に再デプロイを開始します。

手動で再デプロイする場合：
1. 「デプロイ」画面を開く
2. 「このバージョンを再デプロイ」ボタンをクリック

## それでもエラーが続く場合

### オプション1: `applications`キーを追加（Amplify Gen 2形式）

`amplify.yml`に`applications`キーを追加します：

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

**注意**: この形式はAmplify Gen 2で使用されます。Amplify Hosting（Gen 1）では動作しない可能性があります。

### オプション2: 環境変数を完全にクリア

1. すべての環境変数を一時的に削除
2. 再デプロイを実行
3. 必要に応じて`AMPLIFY_DIFF_DEPLOY`を再設定

## 現在の`amplify.yml`設定（推奨）

環境変数を削除した後、以下の設定が正しく動作します：

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - echo "Current directory:" && pwd
        - echo "Node version:" && node --version
        - echo "NPM version:" && npm --version
        - cd apps/tetris
        - echo "Changed to:" && pwd
        - echo "Installing dependencies..."
        - npm ci
    build:
      commands:
        - cd apps/tetris
        - echo "Building Next.js app..."
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

この設定は既にGitHubにプッシュ済みです。
