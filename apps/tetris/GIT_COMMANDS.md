# Gitコマンド（apps/tetris をGitHubへプッシュ）

以下のコマンドを実行して、`apps/tetris` フォルダの変更をGitHubへプッシュしてください。

## 1. 変更をステージング

```bash
cd /Users/masahiro/MySelector
git add apps/tetris/
```

## 2. コミット

```bash
git commit -m "feat: スマホ用テトリスアプリを追加

- Next.js + TypeScript + Tailwind CSSで実装
- PWA対応（manifest.json設定済み）
- テトリスゲームロジック実装
- スマホ操作用ボタン配置
- ネオン風ダークテーマ
- localStorageでハイスコア保存
- AWS連携用API route雛形作成"
```

## 3. GitHubへプッシュ

```bash
git push origin main
```

## 注意事項

- PWAアイコン（`public/icon-192.png` と `public/icon-512.png`）はまだ作成されていません。必要に応じて作成してからコミットしてください。
- `.gitignore` に `node_modules/` が含まれていることを確認してください（Next.jsの初期化時に自動的に設定されているはずです）。
