# My AWS Apps

AWS環境で開発する各種アプリケーションを管理するリポジトリです。

## プロジェクト構成

```
my-aws-apps/
├── apps/
│   ├── notion-integration/     # Notion連携アプリ
│   ├── task-management/        # タスク管理アプリ（開発予定）
│   └── [今後追加するアプリ]/
├── infrastructure/              # 共通のAWS設定（必要に応じて）
└── README.md
```

## 各アプリケーション

### Notion連携アプリ
Notion APIを使用してNotionデータベースに接続し、データを取得・表示するアプリケーション。

詳細は [apps/notion-integration/README.md](./apps/notion-integration/README.md) を参照してください。

### タスク管理アプリ
AWS環境で開発するタスク管理アプリケーション（開発予定）

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
