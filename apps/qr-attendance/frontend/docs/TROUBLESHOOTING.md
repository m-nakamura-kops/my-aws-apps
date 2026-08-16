# フロントエンド トラブルシューティング

## ChunkLoadError: Loading chunk app/layout failed (timeout)

**症状**: ブラウザで「Unhandled Runtime Error」「ChunkLoadError」「timeout: http://localhost:3xxx/_next/static/chunks/app/layout.js」と表示される。

**主な原因**
- 開発サーバーが複数起動しており、古いポートにアクセスしている
- `.next` キャッシュの不整合や破損
- マシンの「開くファイル数」制限（EMFILE）でサーバーが重くなっている

**対処手順**

### 1. 開発サーバーを一度すべて止める

ターミナルで Next を起動しているウィンドウで `Ctrl+C`。別ターミナルでも `npm run dev` や `next dev` が動いていれば同様に止める。

### 2. キャッシュを消してから起動し直す

```bash
cd apps/qr-attendance/frontend
npm run dev:clean
```

（`dev:clean` は `.next` を削除してから `next dev` を実行します。通常の `npm run dev` でも、手動で `rm -rf .next` してから `npm run dev` でも可。）

### 3. 表示されているポートで開く

起動ログの「Local: http://localhost:XXXX」の **XXXX** を確認し、ブラウザではそのポートで開く（例: `http://localhost:3000`）。3001〜3004 など別ポートのままにしていると、古いプロセスや壊れたチャンクが返って ChunkLoadError になることがあります。

### 4. ブラウザのハードリロード

`Cmd+Shift+R`（Mac）または `Ctrl+Shift+R`（Windows）でキャッシュを無視して再読み込み。

### 5. EMFILE（too many open files）が出ている場合

ターミナルに `EMFILE: too many open files` や `Watchpack Error` が出ている場合は、一度ターミナルで以下を実行してから再度 `npm run dev:clean` を試す。

```bash
ulimit -n 10240
```

---

## 404 / missing required error components

ルート（`/`）で 404 や「missing required error components」が出る場合も、上記の「キャッシュ削除 → 1つの dev サーバーで起動し直す」が有効なことが多いです。`npm run dev:clean` を試してください。
