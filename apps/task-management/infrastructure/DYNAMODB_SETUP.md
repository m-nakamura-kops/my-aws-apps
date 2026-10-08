# DynamoDBテーブル作成手順

タスク管理アプリで使用するDynamoDBテーブル「Tasks」の作成手順です。

## 📋 テーブル仕様

- **テーブル名**: `Tasks`
- **パーティションキー（PK）**: `userId` (String型)
- **ソートキー（SK）**: `taskId` (String型)
- **課金モード**: オンデマンド（PAY_PER_REQUEST）
- **暗号化**: 有効（デフォルト）

## 🚀 作成方法

### 方法1: AWS CLIを使用（推奨）

#### 前提条件

1. AWS CLIがインストールされていること
   ```bash
   aws --version
   ```

2. AWS認証情報が設定されていること
   ```bash
   aws configure
   # AWS Access Key ID, Secret Access Key, リージョン（ap-northeast-1）を入力
   ```

#### 手順1: 簡単な方法（スクリプトを使用）

```bash
cd apps/task-management/infrastructure
./create-dynamodb-table.sh
```

または、所有者名を指定する場合：

```bash
./create-dynamodb-table.sh YourName
```

#### 手順2: 手動でコマンドを実行

```bash
aws dynamodb create-table \
  --table-name Tasks \
  --region ap-northeast-1 \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=taskId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=taskId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --tags \
    Key=Project,Value=TaskApp \
    Key=Env,Value=Dev \
    Key=Owner,Value=YourName
```

#### テーブルの作成確認

```bash
aws dynamodb describe-table \
  --table-name Tasks \
  --region ap-northeast-1 \
  --query 'Table.[TableName,TableStatus,BillingModeSummary.BillingMode]' \
  --output table
```

### 方法2: AWSコンソールを使用

#### 手順1: DynamoDBコンソールにアクセス

1. [AWSマネジメントコンソール](https://console.aws.amazon.com/)にログイン
2. 検索バーで「DynamoDB」と検索して選択
3. リージョンが「アジアパシフィック（東京）ap-northeast-1」であることを確認

#### 手順2: テーブルを作成

1. 「テーブルの作成」ボタンをクリック
2. 以下の情報を入力：

   **基本設定**
   - テーブル名: `Tasks`
   - パーティションキー: `userId` (String)
   - ソートキー: `taskId` (String)

   **テーブル設定**
   - テーブルクラス: 標準
   - 容量設定: オンデマンド（推奨）

   **暗号化設定**
   - 暗号化タイプ: AWS所有キー（デフォルト）

   **タグ**
   - Project: `TaskApp`
   - Env: `Dev`
   - Owner: `YourName`（あなたの名前）

3. 「テーブルの作成」ボタンをクリック

#### 手順3: 作成確認

テーブル一覧に「Tasks」が表示され、ステータスが「アクティブ」になっていることを確認します。

## ✅ 作成後の確認事項

### 1. テーブルが正常に作成されたか確認

```bash
aws dynamodb describe-table \
  --table-name Tasks \
  --region ap-northeast-1
```

### 2. テストデータの投入（オプション）

```bash
aws dynamodb put-item \
  --table-name Tasks \
  --item '{
    "userId": {"S": "test-user"},
    "taskId": {"S": "test-task-001"},
    "title": {"S": "テストタスク"},
    "description": {"S": "これはテストです"},
    "status": {"S": "todo"},
    "createdAt": {"S": "2024-01-01T00:00:00Z"},
    "updatedAt": {"S": "2024-01-01T00:00:00Z"}
  }' \
  --region ap-northeast-1
```

### 3. テストデータの取得確認

```bash
aws dynamodb query \
  --table-name Tasks \
  --key-condition-expression "userId = :userId" \
  --expression-attribute-values '{":userId":{"S":"test-user"}}' \
  --region ap-northeast-1
```

## 🔧 トラブルシューティング

### エラー: テーブルが既に存在する

```bash
# テーブルを削除してから再作成
aws dynamodb delete-table \
  --table-name Tasks \
  --region ap-northeast-1

# 削除完了を待つ
aws dynamodb wait table-not-exists \
  --table-name Tasks \
  --region ap-northeast-1

# 再度作成
./create-dynamodb-table.sh
```

### エラー: 権限が不足している

以下のIAMポリシーが必要です：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:DeleteTable"
      ],
      "Resource": "arn:aws:dynamodb:ap-northeast-1:*:table/Tasks"
    }
  ]
}
```

### エラー: リージョンが異なる

リージョンを確認・変更：

```bash
# 現在のリージョンを確認
aws configure get region

# リージョンを設定
aws configure set region ap-northeast-1
```

## 📊 テーブル構造の説明

### キー設計

- **パーティションキー（PK）**: `userId`
  - ユーザーごとにデータを分散
  - 同じuserIdのタスクは同じパーティションに保存される

- **ソートキー（SK）**: `taskId`
  - 各タスクの一意のID（UUID）
  - userIdとtaskIdの組み合わせで一意に識別

### データ構造の例

```json
{
  "userId": "user-123",
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "タスクのタイトル",
  "description": "タスクの説明",
  "dueDate": "2024-12-31",
  "status": "todo",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

## 💰 コストについて

- **オンデマンド課金モード**: 使用した分だけ課金
- **無料枠**: 毎月25GBのストレージ、25ユニットの書き込み容量、25ユニットの読み取り容量が無料
- **個人利用**: 通常は無料枠内で収まります

## 🔗 次のステップ

テーブル作成後は、以下の手順に進んでください：

1. ✅ DynamoDBテーブル作成（この手順）
2. ⏭️ Lambda関数のデプロイ
3. ⏭️ API Gatewayの設定
4. ⏭️ フロントエンドのデプロイ

詳細は `README.md` を参照してください。

