# Notion連携アプリ

このアプリケーションはNotion APIを使用してNotionデータベースに接続し、データを取得・表示できます。

## セットアップ方法

### 1. Notion Integrationの作成

1. [Notion Integrations](https://www.notion.so/my-integrations) にアクセス
2. 「+ New integration」をクリック
3. 名前を入力してIntegrationを作成
4. 「Internal Integration Token」をコピー（`secret_`で始まる文字列）

### 2. Notionデータベースの共有設定

1. Notionでデータベースを開く
2. 右上の「...」メニューから「Connections」を選択
3. 作成したIntegrationを選択して接続

### 3. データベースIDの取得

1. NotionデータベースのURLをコピー
2. URLは以下の形式: `https://www.notion.so/workspace/DATABASE_ID?v=...`
3. `DATABASE_ID`の部分（32文字）をコピー

### 4. アプリの使用

1. `index.html`をブラウザで開く
2. 「Notion API キー」欄にIntegration Tokenを入力
3. 「接続」ボタンをクリック
4. 「データベースID」欄にデータベースIDを入力
5. 「データベースを読み込む」ボタンをクリック

## 機能

- Notion APIキーによる認証
- データベースのクエリ
- ページ情報の取得
- 各種プロパティタイプの表示対応

## 注意事項

- APIキーはブラウザのローカルストレージに保存されます
- 本番環境では、APIキーをフロントエンドに直接保存しないことを推奨します
- CORSエラーが発生する場合は、バックエンドサーバーを使用してください


