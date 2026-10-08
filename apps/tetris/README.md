# スマホ用テトリス

Next.js + TypeScript + Tailwind CSSで実装されたPWA対応のテトリスゲームです。

## 機能

- 🎮 完全なテトリスゲームロジック
- 📱 PWA対応（ホーム画面に追加可能）
- 🎨 ネオン風ダークテーマ
- 📊 ハイスコア保存（localStorage）
- 🎯 レベルシステム
- 🎹 スマホ操作用の大きなボタン

## セットアップ

```bash
cd apps/tetris
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開いてください。

## PWAアイコンの作成

PWAとして動作させるには、以下のアイコンファイルが必要です：

- `public/icon-192.png` (192x192px)
- `public/icon-512.png` (512x512px)

### アイコン作成方法

#### 方法1: 自動生成スクリプトを使用（推奨）

`public/icon.svg` からPNGアイコンを自動生成します：

```bash
cd apps/tetris
./public/create-icons.sh
```

**必要なツール:**
- ImageMagick: `brew install imagemagick` (macOS) または `sudo apt-get install imagemagick` (Ubuntu)
- または Inkscape: `brew install inkscape` (macOS) または `sudo apt-get install inkscape` (Ubuntu)

#### 方法2: オンラインツールを使用

1. [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator) を使用
2. [RealFaviconGenerator](https://realfavicongenerator.net/) を使用
3. `public/icon.svg` をアップロードしてPNGに変換

#### 方法3: 手動で作成

1. `public/icon.svg` を参考に、テトリスをテーマにしたデザインを作成
2. 192x192px と 512x512px のPNG画像を作成
3. `public/` フォルダに配置

**注意**: アイコンが作成されていない場合でも、ゲーム自体は正常に動作します。PWAとして「ホーム画面に追加」する機能のみが制限されます。

## AWS Amplify (Gen 2) へのデプロイ

将来的にAWS Amplify Gen 2でデプロイする場合：

1. Amplify Gen 2の設定ファイルを作成
2. DynamoDBとの連携を実装（`src/app/api/score/route.ts`を完成させる）
3. ビルドとデプロイを実行

## 開発

- `npm run dev` - 開発サーバー起動
- `npm run build` - プロダクションビルド
- `npm run start` - プロダクションサーバー起動
- `npm run lint` - ESLint実行

## ファイル構造

```
apps/tetris/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── score/
│   │   │       └── route.ts    # AWS連携用API（雛形）
│   │   ├── layout.tsx          # ルートレイアウト（PWA設定含む）
│   │   ├── page.tsx            # メインページ
│   │   └── globals.css         # グローバルスタイル
│   └── components/
│       └── Tetris.tsx          # テトリスゲームコンポーネント
├── public/
│   ├── manifest.json           # PWAマニフェスト
│   ├── icon-192.png           # PWAアイコン（要作成）
│   └── icon-512.png           # PWAアイコン（要作成）
└── package.json
```
