#!/bin/bash

# ============================================
# QRコード打刻システム セットアップスクリプト
# ============================================

set -e

echo "=========================================="
echo "QRコード打刻システム セットアップ開始"
echo "=========================================="

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# プロジェクトルート
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ============================================
# 1. フロントエンドのセットアップ
# ============================================
echo ""
echo -e "${GREEN}[1/4] フロントエンドのセットアップ${NC}"
cd frontend

if [ ! -f ".env.local" ]; then
    echo "  .env.local を作成中..."
    cp .env.example .env.local
    echo -e "${YELLOW}  ⚠️  .env.local を編集して環境変数を設定してください${NC}"
else
    echo "  .env.local は既に存在します"
fi

echo "  依存関係をインストール中..."
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

echo -e "${GREEN}  ✓ フロントエンドのセットアップ完了${NC}"

# ============================================
# 2. バックエンドのセットアップ
# ============================================
echo ""
echo -e "${GREEN}[2/4] バックエンドのセットアップ${NC}"
cd ../backend

if [ ! -f ".env" ]; then
    echo "  .env を作成中..."
    cp .env.example .env
    echo -e "${YELLOW}  ⚠️  .env を編集して環境変数を設定してください${NC}"
else
    echo "  .env は既に存在します"
fi

echo "  依存関係をインストール中..."
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

echo -e "${GREEN}  ✓ バックエンドのセットアップ完了${NC}"

# ============================================
# 3. データベースの確認
# ============================================
echo ""
echo -e "${GREEN}[3/4] データベースの確認${NC}"
cd ../database

if [ -f "schema.sql" ]; then
    echo "  schema.sql が見つかりました"
    echo -e "${YELLOW}  ⚠️  データベースをセットアップしてください:${NC}"
    echo "    mysql -u root -p qr_attendance < schema.sql"
else
    echo -e "${RED}  ✗ schema.sql が見つかりません${NC}"
fi

# ============================================
# 4. 完了メッセージ
# ============================================
echo ""
echo "=========================================="
echo -e "${GREEN}セットアップ完了！${NC}"
echo "=========================================="
echo ""
echo "次のステップ:"
echo "1. 環境変数ファイルを編集:"
echo "   - frontend/.env.local"
echo "   - backend/.env"
echo ""
echo "2. データベースをセットアップ:"
echo "   cd database"
echo "   mysql -u root -p qr_attendance < schema.sql"
echo ""
echo "3. 開発サーバーを起動:"
echo "   # フロントエンド"
echo "   cd frontend && npm run dev"
echo ""
echo "   # バックエンド（別ターミナル）"
echo "   cd backend && npm run dev"
echo ""
