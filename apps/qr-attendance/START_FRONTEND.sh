#!/bin/bash

# フロントエンドサーバー起動スクリプト

echo "🚀 QRコード打刻システム - フロントエンドサーバー起動"
echo ""

# プロジェクトルートに移動
cd "$(dirname "$0")/frontend" || exit 1

# 環境変数ファイルの確認
if [ ! -f ".env.local" ]; then
  echo "⚠️  .env.localファイルが見つかりません"
  if [ -f ".env.example" ]; then
    cp .env.example .env.local
    echo "   .env.localファイルを作成しました。"
    echo "   NEXT_PUBLIC_API_URL=http://localhost:3001 が設定されていることを確認してください。"
  fi
fi

# 依存関係の確認
if [ ! -d "node_modules" ]; then
  echo "📦 依存関係をインストール中..."
  npm install
fi

echo ""
echo "✅ 準備完了"
echo ""
echo "フロントエンドサーバーを起動します..."
echo "ブラウザで http://localhost:3000 にアクセスしてください。"
echo ""

# サーバーを起動
npm run dev
