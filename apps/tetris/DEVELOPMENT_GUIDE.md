# テトリスアプリ開発ガイド

## 概要

このドキュメントは、テトリスアプリの修正やバージョンアップを行う際の手順を説明します。

## 開発環境のセットアップ

### 1. リポジトリのクローン（初回のみ）

```bash
git clone https://github.com/m-nakamura-kops/my-aws-apps.git
cd my-aws-apps
```

### 2. 依存関係のインストール

```bash
cd apps/tetris
npm install
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開いて動作確認できます。

## 開発フロー

### 1. ブランチの作成（推奨）

機能追加や修正を行う場合は、新しいブランチを作成します：

```bash
git checkout -b feature/機能名
# 例: git checkout -b feature/add-sound-effects
```

### 2. コードの修正

- `apps/tetris/src/components/Tetris.tsx`: ゲームロジックとUI
- `apps/tetris/src/app/globals.css`: スタイル設定
- `apps/tetris/src/app/layout.tsx`: メタデータとPWA設定
- `apps/tetris/public/manifest.json`: PWA設定

### 3. ローカルでの動作確認

```bash
# 開発サーバーを起動
npm run dev

# ブラウザで確認
# - デスクトップ: http://localhost:3000
# - スマホ: 同じネットワークで http://[PCのIPアドレス]:3000
```

### 4. ビルドの確認

```bash
npm run build
```

ビルドエラーがないことを確認します。

### 5. 変更のコミット

```bash
# 変更をステージング
git add apps/tetris/src/components/Tetris.tsx
# または、すべての変更を追加
git add apps/tetris/

# コミット
git commit -m "fix: 修正内容の説明"
# 例: git commit -m "fix: ゲームボードのタップで一時停止が動作するように修正"
```

### 6. GitHubへのプッシュ

```bash
# メインブランチの場合
git push origin main

# ブランチを作成した場合
git push origin feature/機能名
```

### 7. AWS Amplifyでの自動デプロイ

GitHubにプッシュすると、Amplifyが自動的にデプロイを開始します。

1. **Amplifyコンソールで確認**
   - https://console.aws.amazon.com/amplify/
   - 「my-aws-apps」アプリを選択
   - 「デプロイ」画面でビルド状況を確認

2. **ビルドログの確認**
   - デプロイが失敗した場合、ビルドログを確認
   - エラーメッセージを確認して修正

3. **動作確認**
   - デプロイが完了したら、スマホで動作確認
   - URL: `https://main.d1oyckn215kaju.amplifyapp.com`

## よくある作業

### ゲームロジックの修正

1. `apps/tetris/src/components/Tetris.tsx`を編集
2. ローカルで動作確認
3. コミット＆プッシュ
4. Amplifyでデプロイ確認

### スタイルの調整

1. `apps/tetris/src/app/globals.css`または`Tetris.tsx`のスタイルを編集
2. ローカルで動作確認（特にスマホ表示）
3. コミット＆プッシュ
4. Amplifyでデプロイ確認

### PWA設定の変更

1. `apps/tetris/public/manifest.json`を編集
2. `apps/tetris/src/app/layout.tsx`のメタデータを編集
3. 必要に応じてアイコンを更新
4. コミット＆プッシュ
5. Amplifyでデプロイ確認

### 新機能の追加

1. 新しいブランチを作成
2. 機能を実装
3. ローカルで動作確認
4. コミット＆プッシュ
5. Amplifyでデプロイ確認
6. 問題なければメインブランチにマージ

## トラブルシューティング

### ビルドエラーが発生した場合

1. **ローカルでビルドを実行**
   ```bash
   cd apps/tetris
   npm run build
   ```

2. **エラーメッセージを確認**
   - TypeScriptエラー
   - 依存関係のエラー
   - 構文エラー

3. **修正して再ビルド**
   ```bash
   npm run build
   ```

### デプロイが失敗した場合

1. **Amplifyコンソールでビルドログを確認**
   - エラーメッセージを特定

2. **よくある原因**
   - `amplify.yml`の設定ミス
   - 依存関係のエラー
   - ビルド成果物のパスが間違っている

3. **修正方法**
   - `apps/tetris/AMPLIFY_BUILD_FIX.md`を参照
   - `apps/tetris/AMPLIFY_ENV_VAR_REMOVAL.md`を参照

### スマホで動作しない場合

1. **ローカルでスマホからアクセス**
   - 同じネットワークで `http://[PCのIPアドレス]:3000`

2. **ブラウザの開発者ツールを使用**
   - Chrome DevToolsのデバイスモードで確認

3. **実際のスマホで確認**
   - AmplifyのデプロイURLにアクセス

## ファイル構成

```
apps/tetris/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # メタデータとPWA設定
│   │   ├── page.tsx            # メインページ
│   │   └── globals.css         # グローバルスタイル
│   └── components/
│       └── Tetris.tsx          # ゲームロジックとUI
├── public/
│   ├── manifest.json           # PWA設定
│   ├── icon-192.png           # PWAアイコン（192x192）
│   └── icon-512.png           # PWAアイコン（512x512）
├── amplify.yml                 # Amplifyビルド設定（monorepo用）
├── package.json               # 依存関係
└── README.md                  # プロジェクト説明
```

## 参考ドキュメント

- `apps/tetris/README.md`: プロジェクト概要
- `apps/tetris/AMPLIFY_BUILD_FIX.md`: ビルドエラーの対処法
- `apps/tetris/AMPLIFY_ENV_VAR_REMOVAL.md`: 環境変数の設定方法
- `apps/tetris/AMPLIFY_SETUP_FINAL.md`: Amplify設定の最終確認
- `apps/tetris/FEATURES.md`: 実装済み機能一覧

## コミットメッセージの規約

コミットメッセージは以下の形式を推奨します：

```
種類: 変更内容の説明

例:
fix: ゲームボードのタップで一時停止が動作するように修正
feat: サウンドエフェクトを追加
refactor: コードのリファクタリング
docs: ドキュメントを更新
```

種類:
- `fix`: バグ修正
- `feat`: 新機能追加
- `refactor`: リファクタリング
- `docs`: ドキュメント更新
- `style`: スタイル変更
- `test`: テスト追加・修正

## 次のステップ

### 機能追加のアイデア

- [ ] サウンドエフェクトの追加
- [ ] ハイスコアランキング（AWS DynamoDB連携）
- [ ] ゲームモードの追加（スプリント、マラソンなど）
- [ ] テーマのカスタマイズ
- [ ] リプレイ機能
- [ ] 統計情報の表示

### パフォーマンス改善

- [ ] ゲームループの最適化
- [ ] レンダリングの最適化
- [ ] メモリ使用量の削減

### UX改善

- [ ] アニメーションの追加
- [ ] 操作感の改善
- [ ] エラーメッセージの改善

## サポート

問題が発生した場合：

1. エラーメッセージを確認
2. 関連ドキュメントを参照
3. 必要に応じてGitHubのIssuesで報告
