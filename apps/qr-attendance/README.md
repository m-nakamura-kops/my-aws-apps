# QRコード打刻システム

## 概要

QRコードを用いたイベント参加者の打刻管理システムです。AWS Amplify、Cognito、API Gateway、Lambda、RDSを使用したフルスタックアプリケーションです。

## システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                        ユーザー                              │
│                    (スマホ/PCブラウザ)                        │
└───────────────────────┬───────────────────────────────────────┘
                        │ HTTPS
                        │
        ┌───────────────▼────────────────┐
        │     AWS Amplify Hosting        │
        │  (Next.js SSR + Static Assets) │
        └───────────────┬────────────────┘
                        │
        ┌───────────────▼────────────────┐
        │      Amazon Cognito             │
        │  (認証・認可)                    │
        └───────────────┬────────────────┘
                        │
        ┌───────────────▼────────────────┐
        │      API Gateway               │
        │  (REST API)                    │
        └───────────────┬────────────────┘
                        │
        ┌───────────────▼────────────────┐
        │      AWS Lambda                │
        │  (ビジネスロジック)              │
        └───────────────┬────────────────┘
                        │
        ┌───────────────▼────────────────┐
        │      Amazon RDS                │
        │  (MySQL/MariaDB)               │
        └────────────────────────────────┘
```

## プロジェクト構成

```
apps/qr-attendance/
├── frontend/                 # フロントエンド（Next.js）
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   ├── components/      # Reactコンポーネント
│   │   └── lib/             # ユーティリティ
│   ├── public/              # 静的ファイル
│   └── package.json
├── backend/                  # バックエンド（Lambda）
│   ├── functions/           # Lambda関数
│   │   ├── auth/            # 認証関連
│   │   ├── users/           # ユーザー管理
│   │   ├── events/          # イベント管理
│   │   ├── attendance/      # 打刻機能
│   │   └── admin/           # 管理者機能
│   └── shared/              # 共通コード
│       ├── db/              # DB接続
│       └── utils/           # ユーティリティ
├── infrastructure/           # Infrastructure as Code
│   ├── cdk/                 # AWS CDK
│   └── cloudformation/      # CloudFormation（オプション）
├── database/                 # データベース定義
│   ├── schema.sql           # DDL
│   └── migrations/          # マイグレーション
└── docs/                     # ドキュメント
    ├── API.md               # API仕様書
    ├── ARCHITECTURE.md      # アーキテクチャ詳細
    └── ROADMAP.md           # 実装ロードマップ
```

## 機能一覧

### 利用者向け機能
- ユーザー登録・ログイン
- マイページ（QRコード表示）
- 参加イベント履歴表示
- スケジュール表示

### 管理者向け機能
- 生徒名簿管理
- イベント作成・管理
- 打刻レポート出力
- お知らせ投稿
- スタッフ管理

## セットアップ

### クイックスタート（推奨）

**今日から開発を始める最短手順**は [クイックスタートガイド](./docs/QUICK_START.md) を参照してください。

### 前提条件
- Node.js 18.x以上
- AWS CLI設定済み（本番環境用）
- MySQL/MariaDB（ローカル開発用）

### 初期セットアップ

詳細な手順は [セットアップガイド](./docs/SETUP.md) を参照してください。

#### 自動セットアップ（推奨）

```bash
cd apps/qr-attendance
./scripts/setup.sh
```

#### 手動セットアップ

```bash
# 1. 環境変数ファイルの作成
cd backend && cp .env.example .env
cd ../frontend && cp .env.example .env.local

# 2. 依存関係のインストール
cd frontend && npm install
cd ../backend && npm install

# 3. データベースのセットアップ
cd ../database
mysql -u root -p qr_attendance < schema.sql
```

## 開発ガイド

### ドキュメント一覧

- **[クイックスタートガイド](./docs/QUICK_START.md)** - 今日から開発を始める最短手順
- **[セットアップガイド](./docs/SETUP.md)** - 詳細なセットアップ手順
- **[GitHubプッシュガイド](./docs/GITHUB_PUSH_GUIDE.md)** - GitHubへのプッシュ方法
- **[実装ロードマップ](./docs/ROADMAP.md)** - 開発計画（10フェーズ）
- **[API仕様書](./docs/API.md)** - REST API仕様
- **[アーキテクチャ詳細](./docs/ARCHITECTURE.md)** - システムアーキテクチャ

### 開発フロー

詳細は [docs/ROADMAP.md](./docs/ROADMAP.md) を参照してください。

## ライセンス

MIT License
