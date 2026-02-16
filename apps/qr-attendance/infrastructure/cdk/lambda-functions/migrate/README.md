# Database Migration Lambda Function

## 概要

RDSにデータベーススキーマを適用するLambda関数です。

## セットアップ

```bash
cd lambda-functions/migrate
npm install
```

## 使用方法

API Gatewayエンドポイント経由で実行：

```bash
curl -X POST https://[API_URL]/migrate
```

## 注意事項

- この関数は開発環境でのみ使用してください
- 本番環境では、適切な認証を追加してください
- スキーマは`CREATE TABLE IF NOT EXISTS`を使用しているため、既存のテーブルには影響しません
