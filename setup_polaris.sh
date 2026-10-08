#!/bin/bash

# Polaris環境構築スクリプト
# 使用方法: ./setup_polaris.sh

set -e

echo "🚀 Polaris環境構築を開始します..."

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. SSH鍵の確認
echo ""
echo "📋 ステップ1: SSH鍵の確認"
if [ ! -f ~/.ssh/id_ed25519.pub ]; then
    echo -e "${YELLOW}⚠️  SSH鍵が見つかりません。生成します...${NC}"
    ssh-keygen -t ed25519 -C "developer@ko-partners.biz" -f ~/.ssh/id_ed25519 -N ""
fi

echo -e "${GREEN}✅ SSH鍵を確認しました${NC}"
echo ""
echo "以下の公開鍵をGitHubに追加してください:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat ~/.ssh/id_ed25519.pub
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. GitHubにログイン: https://github.com/settings/keys"
echo "2. 「New SSH key」をクリック"
echo "3. 上記の公開鍵を貼り付けて保存"
echo "4. 「Configure SSO」→「Authorize」でJPDigitalCoLtd組織へのアクセスを承認"
echo ""
read -p "GitHubへの公開鍵追加とSSO認証が完了したら Enter キーを押してください..."

# 2. GitHub接続テスト
echo ""
echo "📋 ステップ2: GitHub接続テスト"
if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    echo -e "${GREEN}✅ GitHub接続に成功しました${NC}"
else
    echo -e "${YELLOW}⚠️  GitHub接続を確認できませんでしたが、続行します...${NC}"
fi

# 3. リポジトリのクローン
echo ""
echo "📋 ステップ3: リポジトリのクローン"
if [ -d ~/jp-polaris-app ]; then
    echo -e "${YELLOW}⚠️  リポジトリは既に存在します: ~/jp-polaris-app${NC}"
    read -p "既存のリポジトリを使用しますか？ (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "既存のリポジトリを削除して再クローンしますか？ (y/n): "
        read -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf ~/jp-polaris-app
            git clone git@github.com:JPDigitalCoLtd/jp-polaris-app.git ~/jp-polaris-app
        fi
    fi
else
    echo "リポジトリをクローンしています..."
    git clone git@github.com:JPDigitalCoLtd/jp-polaris-app.git ~/jp-polaris-app
    echo -e "${GREEN}✅ リポジトリのクローンが完了しました${NC}"
fi

cd ~/jp-polaris-app

# 4. Docker環境のセットアップ
echo ""
echo "📋 ステップ4: Docker環境のセットアップ"
if [ ! -f docker-compose.yml ]; then
    echo -e "${RED}❌ docker-compose.ymlが見つかりません${NC}"
    exit 1
fi

echo "Dockerコンテナを起動しています..."
docker-compose up -d

echo "Dockerコンテナの状態を確認しています..."
sleep 5
docker-compose ps

echo -e "${GREEN}✅ Docker環境のセットアップが完了しました${NC}"

# 5. .envファイルの確認
echo ""
echo "📋 ステップ5: .envファイルの確認"
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .envファイルが見つかりません${NC}"
    echo "POLARIS_SETUP_GUIDE.mdを参照して.envファイルを作成してください"
    echo "または、既存の.env.exampleファイルがある場合はコピーしてください"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ .env.exampleから.envファイルを作成しました${NC}"
        echo "必要に応じて.envファイルを編集してください"
    fi
else
    echo -e "${GREEN}✅ .envファイルが存在します${NC}"
fi

# 6. 依存関係のインストール
echo ""
echo "📋 ステップ6: 依存関係のインストール"
if [ -f package.json ]; then
    echo "npm installを実行しています..."
    npm install
    echo -e "${GREEN}✅ 依存関係のインストールが完了しました${NC}"
else
    echo -e "${YELLOW}⚠️  package.jsonが見つかりません${NC}"
fi

# 7. 完了メッセージ
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 環境構築が完了しました！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "次のステップ:"
echo "1. .envファイルを確認・編集してください（必要に応じて）"
echo "2. アプリケーションを起動: cd ~/jp-polaris-app && npm run dev"
echo "3. ブラウザで http://localhost:5001 にアクセス"
echo ""
echo "検証環境にアクセスする場合は、VPN設定が必要です:"
echo "- URL: https://jpai-polaris-dev.azurewebsites.net/miniapps"
echo "- VPN設定はPOLARIS_SETUP_GUIDE.mdを参照してください"
echo ""

