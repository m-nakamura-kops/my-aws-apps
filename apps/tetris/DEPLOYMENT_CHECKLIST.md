# デプロイ前チェックリスト

## ✅ 完了済み

- [x] Next.jsアプリの実装完了
- [x] テトリスゲームロジック実装完了
- [x] PWA設定（manifest.json、メタタグ）
- [x] スマホ最適化レイアウト
- [x] バグ修正完了
- [x] プロダクションビルド確認済み
- [x] amplify.yml作成済み
- [x] GitHubへプッシュ完了

## 📋 デプロイ前の最終確認

### 1. ビルド確認

```bash
cd apps/tetris
npm run build
```

✅ ビルドが成功することを確認

### 2. ローカル動作確認

```bash
npm run dev
```

確認項目：
- [ ] ゲームが正常に動作する
- [ ] スマホ画面でスクロールなしで全ての要素が表示される
- [ ] ゲームボードをタップで一時停止/再開ができる
- [ ] すべての操作ボタンが正常に動作する
- [ ] ハードドロップ機能が正常に動作する
- [ ] 位置調整期間が正常に動作する

### 3. PWAアイコンの作成（オプション）

PWAとして完全に動作させるには、アイコンが必要です：

```bash
cd apps/tetris/public
# ImageMagickがインストールされている場合
brew install imagemagick
./create-icons.sh

# またはオンラインツールを使用
# https://realfavicongenerator.net/
```

作成後、GitHubへプッシュ：
```bash
git add apps/tetris/public/icon-*.png
git commit -m "feat: PWAアイコンを追加"
git push origin main
```

## 🚀 AWS Amplify Gen 2へのデプロイ

### ステップ1: Amplifyコンソールでアプリ作成

1. [AWS Amplify Console](https://console.aws.amazon.com/amplify/)にアクセス
2. 「新しいアプリ」→「GitHubからホスト」を選択
3. GitHubリポジトリ（`m-nakamura-kops/my-aws-apps`）を選択
4. ブランチ（`main`）を選択

### ステップ2: ビルド設定確認

**アプリ設定:**
- アプリ名: `tetris-app`（任意）
- 環境: `main`

**ビルド設定:**
- ビルド設定ファイル: `amplify.yml`（自動検出されるはず）

**環境変数:**
- 現在は不要（DynamoDB連携時に追加）

### ステップ3: デプロイ実行

1. 「保存してデプロイ」をクリック
2. ビルドログを確認
3. デプロイ完了後、提供されるURLでアクセス

### ステップ4: デプロイ後の確認

- [ ] アプリが正常に表示される
- [ ] ゲームが正常に動作する
- [ ] HTTPSでアクセスできる
- [ ] PWAとして「ホーム画面に追加」ができる（HTTPS環境で）
- [ ] スマホ画面でスクロールなしで表示される

## 🔧 トラブルシューティング

### ビルドエラーが発生する場合

1. **Node.jsバージョンの確認**
   - AmplifyコンソールでNode.jsバージョンを18.x以上に設定

2. **ビルドログの確認**
   - Amplifyコンソールの「ビルドログ」タブでエラーを確認
   - ローカルで`npm run build`を実行してエラーを確認

3. **amplify.ymlの確認**
   - ルートディレクトリに`amplify.yml`が存在することを確認
   - パスが正しいことを確認（`apps/tetris`）

### 404エラーが発生する場合

- Next.jsのApp Routerを使用している場合、ルーティングが正しく設定されているか確認
- `next.config.ts`の設定を確認

### PWAが動作しない場合

- HTTPSでアクセスしていることを確認（PWAはHTTPS必須）
- manifest.jsonが正しく配信されているか確認
- ブラウザの開発者ツールでエラーを確認

## 📚 参考資料

- [AWS Amplify Gen 2 Documentation](https://docs.amplify.aws/gen2/)
- [Next.js on AWS Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/deploy-nextjs-app.html)
- [Amplify Build Settings](https://docs.aws.amazon.com/amplify/latest/userguide/build-settings.html)
