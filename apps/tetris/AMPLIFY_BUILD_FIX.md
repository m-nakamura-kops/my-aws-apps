# AWS Amplify ビルドエラー対処ガイド

## 🔍 ビルドログの確認方法

1. **Amplifyコンソールでビルドログを確認**
   - デプロイ履歴で「デプロイ 1」をクリック
   - 「ビルドログ」タブを開く
   - エラーメッセージを確認

2. **よくあるエラーの原因**

### エラー1: パスの問題

**症状**: `amplify.yml`のパスが正しくない

**解決方法**:
ルートディレクトリが`apps/tetris`に設定されている場合、`amplify.yml`のパスは相対パスで記述する必要があります。

### エラー2: Node.jsバージョンの問題

**症状**: Node.jsのバージョンが古い、または指定されていない

**解決方法**:
`amplify.yml`にNode.jsバージョンを明示的に指定：

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - nvm use 18
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

### エラー3: 依存関係のインストールエラー

**症状**: `npm ci`が失敗する

**解決方法**:
`package-lock.json`が正しく存在するか確認。存在しない場合は、`npm install`を実行してからコミット。

### エラー4: ビルドコマンドのエラー

**症状**: `npm run build`が失敗する

**解決方法**:
ローカルでビルドを実行してエラーを確認：

```bash
cd apps/tetris
npm run build
```

## 🔧 修正手順

### ステップ1: ビルドログからエラーを特定

Amplifyコンソールのビルドログで、以下のようなエラーを探してください：

- `Error: Cannot find module`
- `Error: Command failed`
- `Error: ENOENT: no such file or directory`
- `TypeError`や`ReferenceError`

### ステップ2: amplify.ymlを修正

エラーに応じて`amplify.yml`を修正します。

### ステップ3: 修正をコミット・プッシュ

```bash
git add apps/tetris/amplify.yml
git commit -m "fix: Amplifyビルド設定を修正"
git push origin main
```

### ステップ4: 再デプロイ

Amplifyコンソールで「このバージョンを再デプロイ」をクリック、または新しいコミットで自動デプロイを待つ。

## 📝 推奨されるamplify.yml設定

monorepo構造で、ルートディレクトリが`apps/tetris`の場合：

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - nvm use 18 || nvm use 20
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

## 🆘 よくある問題と解決策

### 問題1: ビルド成果物が見つからない

**原因**: `baseDirectory`のパスが間違っている

**解決**: ルートディレクトリが`apps/tetris`の場合、`.next`が正しいパスです。

### 問題2: 環境変数が必要

**原因**: ビルド時に環境変数が必要な場合

**解決**: Amplifyコンソールの「環境変数」セクションで設定。

### 問題3: タイムアウト

**原因**: ビルド時間が長すぎる

**解決**: ビルド時間を短縮するか、Amplifyのビルドタイムアウト設定を確認。
