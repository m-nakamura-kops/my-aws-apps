        　ｂｆ１  1 1q21# My AWS Apps

AWS環境で開発する各種アプリケーションを管理するリポジトリです。

## プロジェクト構成

```
my-aws-apps/
├── apps/
│   ├── notion-integration/     # Notion連携アプリ
│   ├── task-management/        # タスク管理アプリ
│   ├── tetris/                 # テトリスアプリ
│   └── qr-attendance/          # QRコード打刻システム
├── infrastructure/              # 共通のAWS設定（必要に応じて）
└── README.md
```

## 各アプリケーション

### Notion連携アプリ
Notion APIを使用してNotionデータベースに接続し、データを取得・表示するアプリケーション。

詳細は [apps/notion-integration/README.md](./apps/notion-integration/README.md) を参照してください。

### タスク管理アプリ
AWS環境で開発するタスク管理アプリケーション

### テトリスアプリ
Next.jsとAWS Amplifyを使用したテトリスゲームアプリケーション

詳細は [apps/tetris/README.md](./apps/tetris/README.md) を参照してください。

### QRコード打刻システム
QRコードを用いたイベント参加者の打刻管理システム。AWS Amplify、Cognito、API Gateway、Lambda、RDSを使用したフルスタックアプリケーション。

詳細は [apps/qr-attendance/README.md](./apps/qr-attendance/README.md) を参照してください。

## 開発ガイドライン

### 新しいアプリを追加する場合

1. `apps/` ディレクトリに新しいフォルダを作成
2. アプリ固有のREADME.mdを作成
3. 必要に応じて共通のインフラ設定を `infrastructure/` に追加

### ブランチ戦略

- `main`: 安定版
- `feature/[アプリ名]-[機能名]`: 新機能開発
- `bugfix/[アプリ名]-[問題]`: バグ修正

## ライセンス

各アプリケーションのライセンスは、それぞれのディレクトリ内のLICENSEファイルを参照してください。
