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
    ├── USER_MANUAL.md       # 利用マニュアル
    └── ROADMAP.md           # 実装ロードマップ
```

## 機能一覧

### 利用者向け機能
- ユーザー登録・ログイン（Cognito と DB `users` を同期）
- 利用規約・プライバシーポリシーの提示と同意（管理者以外。既存ユーザー含む）
- パスワードをお忘れの場合のセルフリセット（Cognito ForgotPassword）
- マイページ（QRコード表示）
- 参加イベント履歴表示
- スケジュール表示

### スタッフ・管理者向け機能
- 生徒名簿管理・招待（Cognito 招待メール + DB 同時作成）
- スタッフ招待
- イベント作成・管理
- QRスキャン打刻 / 手動打刻
- 打刻レポート出力
- お知らせ投稿

## 認証と打刻の要点

- **Cognito と DB の同期**: 生徒招待（`POST /v1/admin/students`）・スタッフ招待（`POST /v1/admin/invite`）・自己登録（`POST /v1/users/register`）は Cognito ユーザーと `users` 行をセットで作成する。片側だけ成功した場合はロールバックする。ログイン（`POST /v1/users/login`）では、Cognito のみ / DB のみの欠けを相互補完する。
- **パスワードリセット**: ログイン画面の「パスワードをお忘れの方はこちら」から、確認コードメール → 新パスワード設定まで利用者が完了できる（Amplify `resetPassword` / `confirmResetPassword`）。管理者への依頼は不要。
- **利用規約・個人情報保護**: `/terms`・`/privacy` を公開。登録および初回パスワード設定では同意チェック必須。管理者以外で `users.terms_accepted_at` が未設定の既存・招待ユーザーは、ログイン後に同意してからサービスを利用する。同意日時は DB `NOW()`（JST）。
- **打刻（1入退室＝1行）**: 入室は `attendance_logs` に `type=entry` 行を INSERT（`in_time=NOW()`、`out_time=NULL`）。退室は未退室行の `out_time` だけを UPDATE し、新規行は作らない。時刻は DB セッション `+09:00`（JST）の `NOW()` を唯一の時計とする。`out_time = GREATEST(NOW(), in_time)` で逆転を防ぎ、約15秒以内の連続スキャンは同一スキャンとして無視する。
- **DB（マイグレーション 006 以降）**: `attendance_logs.type` を持つ。ビュー `v_attendance_details` は `in_time` のある entry 行を1入退室として返す。

## セットアップ

### AWS環境での開発（推奨）

**ローカルにMySQLをインストールせず、AWS上のリソースを使用する場合**は以下を参照してください：

- **[最初のデプロイ手順](./docs/FIRST_DEPLOY.md)** - 「AWS上にDBの箱を作る」ための最初のアクション
- **[AWS環境セットアップガイド](./docs/AWS_SETUP_GUIDE.md)** - 詳細なAWS環境構築手順

### ローカル環境での開発

**ローカルにMySQLをインストールして開発する場合**は以下を参照してください：

- **[クイックスタートガイド](./docs/QUICK_START.md)** - 今日から開発を始める最短手順

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

## 本番の接続先と削除保護

API のベース URL と DB ホストはソースに書かない。フロントは Amplify の `NEXT_PUBLIC_API_URL`（`frontend/src/lib/api-client.ts`）だけを使い、未設定ならリクエスト前に失敗する。削除済みの API Gateway ホストへのフォールバックは置かない。Cognito の User Pool ID / Client ID は `NEXT_PUBLIC_COGNITO_USER_POOL_ID` と `NEXT_PUBLIC_COGNITO_CLIENT_ID` を優先する。

チェック:

```bash
node apps/qr-attendance/scripts/check-no-hardcoded-api-url.js
```

本番の MySQL と NAT ゲートウェイはスタックから外してある。`QrAttendanceRdsStack` に `AWS::RDS::DBInstance` や `natGateways: 1` を戻すと、延長サポート（MySQL 8.0）と NAT の月額固定費が再発する。VPC と isolated サブネットは post-automation の Aurora PostgreSQL と共有しているので削除しない。

本番デプロイは main ブランチだけが通る（`bin/app.ts` がそれ以外を synth で止める）。入口は `infrastructure/cdk/scripts/deploy-prod.sh`。差分に DB インスタンスや NAT の追加が出たらそこで止まる。月額 $400 の予算 `monthly-cost-guard-400usd` が通知し、RDS の作成・削除・復元は SNS `RdsAlertTopic` に流れる。

`QrAttendanceApiStack-prod` は廃止した。`cdk deploy --all` でも作り直さない。

## 開発ガイド

### ドキュメント一覧

- **[クイックスタートガイド](./docs/QUICK_START.md)** - 今日から開発を始める最短手順
- **[セットアップガイド](./docs/SETUP.md)** - 詳細なセットアップ手順
- **[GitHubプッシュガイド](./docs/GITHUB_PUSH_GUIDE.md)** - GitHubへのプッシュ方法
- **[実装ロードマップ](./docs/ROADMAP.md)** - 開発計画（10フェーズ）
- **[API仕様書](./docs/API.md)** - REST API仕様
- **[アーキテクチャ詳細](./docs/ARCHITECTURE.md)** - システムアーキテクチャ
- **[利用マニュアル](./docs/USER_MANUAL.md)** - 利用者・スタッフ向け操作説明

### 開発フロー

詳細は [docs/ROADMAP.md](./docs/ROADMAP.md) を参照してください。

## ライセンス

MIT License
