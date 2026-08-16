# Amplify環境変数の削除手順（重要）

## エラー

```
!!! CustomerError: Monorepo spec provided without "applications" key
```

このエラーは、`AMPLIFY_MONOREPO_APP_ROOT`環境変数が設定されているが、`amplify.yml`に`applications`キーがない場合に発生します。

## 解決方法

**`AMPLIFY_MONOREPO_APP_ROOT`環境変数を削除する必要があります。**

## 手順

### 1. Amplifyコンソールで環境変数を確認・削除

1. Amplifyコンソールにログイン
2. 「my-aws-apps」アプリを選択
3. 左サイドバーで「ホスティング」を展開
4. 「環境変数」をクリック
5. 環境変数の一覧を確認：
   - `AMPLIFY_MONOREPO_APP_ROOT`が表示されているか確認
   - 表示されている場合、右側の「削除」ボタン（ゴミ箱アイコン）をクリック
   - 確認ダイアログで「削除」をクリック

### 2. 環境変数の削除確認

環境変数の一覧から`AMPLIFY_MONOREPO_APP_ROOT`が消えていることを確認してください。

残っている環境変数：
- `AMPLIFY_DIFF_DEPLOY`: `false`（これは残しておいてOK）

### 3. 再デプロイ

環境変数を削除すると、Amplifyが自動的に再デプロイを開始します。

手動で再デプロイする場合：
1. 「デプロイ」画面を開く
2. 「このバージョンを再デプロイ」ボタンをクリック

## 現在の`amplify.yml`設定

環境変数を削除した後、以下の設定が正しく動作します：

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

## トラブルシューティング

### 環境変数が削除できない場合

1. 「変数を管理」ボタンをクリック
2. `AMPLIFY_MONOREPO_APP_ROOT`を選択
3. 「削除」をクリック

### 環境変数を削除してもエラーが続く場合

1. Amplifyコンソールで「アプリ設定」→「全般設定」を確認
2. 「ブランチ設定」で、各ブランチの環境変数を確認
3. ブランチごとに環境変数が設定されている場合は、そちらも削除

### それでもエラーが続く場合

Amplifyコンソールの「ビルドの設定」画面で、`amplify.yml`の内容を確認：
- 「編集」ボタンをクリック
- 上記の正しい設定をコピー＆ペースト
- 「保存」をクリック

## 確認事項

- [ ] `AMPLIFY_MONOREPO_APP_ROOT`環境変数が削除されている
- [ ] `amplify.yml`で`cd apps/tetris`が実行されている
- [ ] `baseDirectory`が`apps/tetris/.next`になっている
- [ ] 新しいデプロイが開始されている
- [ ] ビルドログでエラーが発生しない
