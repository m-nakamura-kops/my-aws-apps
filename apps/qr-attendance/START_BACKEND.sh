#!/bin/bash

# バックエンドAPIサーバー起動スクリプト

echo "🚀 QRコード打刻システム - バックエンドサーバー起動"
echo ""

# プロジェクトルートに移動
cd "$(dirname "$0")/backend" || exit 1

# 必要なパッケージがインストールされているか確認
if [ ! -d "node_modules/ts-node" ]; then
  echo "📦 ts-nodeをインストール中..."
  npm install --save-dev ts-node nodemon
fi

# ログインLambda関数がビルドされているか確認
if [ ! -f "functions/users/login/index.js" ]; then
  echo "🔨 ログインLambda関数をビルド中..."
  cd functions/users/login
  npm install
  npm run build
  cd ../../..
fi

# 環境変数ファイルの確認
if [ ! -f ".env" ]; then
  echo "⚠️  .envファイルが見つかりません"
  echo "   .env.exampleをコピーして.envを作成してください"
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "   .envファイルを作成しました。データベース接続情報を設定してください。"
  fi
fi

echo ""
echo "✅ 準備完了"
echo ""
echo "バックエンドサーバーを起動します..."
echo ""

# サーバーを起動
npm run dev
