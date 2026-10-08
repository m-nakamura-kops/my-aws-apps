# システム運用・保守ハンドブック（簡略版）

QR Attendance（`apps/qr-attendance`）について、**502 大量発生の解消**から**デプロイ後スモークテスト**までの一連の作業を運用視点でまとめたものです。

---

## 1. インシデント概要（502）

### 現象

- ブラウザから API Gateway 経由で `GET /v1/users/me` 等を呼ぶと **502** が返ることがあった。
- API Gateway の統合失敗として見えるが、実体は **Lambda の初期化失敗**（未捕捉のモジュール読み込みエラー）であることが多い。

### 典型原因（今回）

- Lambda のデプロイ zip 内では共有コードが **`./shared/...`** に配置される。
- 一方、コンパイル後の `index.js` が **`require('../../../shared/...')`** のままだと、zip 内にその相対パスが存在せず、起動時に以下が発生する。

```text
Runtime.ImportModuleError: Cannot find module '...'
```

- **マイページ（`/v1/users/me`）** がこの経路を通るため、画面全体が 502 地獄に見えやすい。

### 修正方針

- 各関数ディレクトリ直下にコピーされた `shared` を指すよう、**バンドル内では `require('./shared/...')` 形式に統一**する。
- 参照例（`users/me`）: `apps/qr-attendance/backend/functions/users/me/index.js`  
  - `./shared/db/connection`  
  - `./shared/db/secrets`  
  - `./shared/utils/response`  
  - `./shared/utils/auth`

### 調査のコツ

1. **CloudWatch Logs** で対象 Lambda の **INIT / ERROR** 行を確認（`ImportModuleError` の有無）。
2. 認証付きで **curl** し、API Gateway 経由の実レスポンスとステータスを確認（ローカルだけの再現と差が出る）。

---

## 2. デプロイ後の検証（スモークテスト）

### 目的

- デプロイ直後に **本番 URL（execute-api）へ外向き HTTP** で主要 API が **200** であることを一括確認し、502 の再発を早期検知する。

### 配置と実行

| 項目 | パス / コマンド |
|------|------------------|
| スクリプト | `apps/qr-attendance/scripts/smoke-test.sh` |
| npm スクリプト | `apps/qr-attendance/package.json` の `smoke-test` |

```bash
cd apps/qr-attendance
npm run smoke-test
```

### 動作概要

1. **API ベース URL**  
   - `aws cloudformation describe-stacks` で **`ApiUrl`** を取得（既定スタック名: `QrAttendanceApiStack-dev`）。  
   - **ハードコード禁止**（スタック／アカウントが変わっても同じ手順で取得）。
2. **ログイン**  
   - `POST /v1/users/login`（JSON: `email`, `password`）。  
   - 既定ユーザー: `it-admin@example.com`（パスワードは環境変数推奨）。
3. **認証付き GET（順次）**  
   - `/v1/users/me`  
   - `/v1/news`  
   - `/v1/events`  
   - `/v1/users/schedule`  
4. **厳格判定**  
   - **200 のみ合格**。  
   - レスポンス本文に `ImportModuleError` 等のエラー文字列が含まれないことも確認。

### 環境変数（任意）

| 変数 | 説明 |
|------|------|
| `SMOKE_STACK_NAME` | CloudFormation スタック名（既定: `QrAttendanceApiStack-dev`） |
| `SMOKE_EMAIL` | ログイン用メール（既定: `it-admin@example.com`） |
| `SMOKE_PASSWORD` | ログイン用パスワード（**本番では必ず注入**。未設定時は開発用の既定値に依存） |

### 依存ツール

- AWS CLI（スタック参照・認証情報）  
- `curl`, `bash`, `jq`

---

## 3. Lambda ビルドと CDK デプロイ（参照）

- バックエンド関数のビルド・依存同期は **CDK 側**の `build:lambda` 系でまとめて実行する運用（`apps/qr-attendance/infrastructure/cdk/package.json`）。
- API スタックの環境変数 **`DB_HOST`** は CDK で **RDS エンドポイント**にバインドされる。ローカル用ホスト名が混ざっていないか、デプロイ後に **Lambda 設定**または **スモーク＋ログ**で確認する。

---

## 4. 運用チェックリスト（短縮）

デプロイまたはインフラ変更のたびに推奨:

1. [ ] 変更した Lambda の CloudWatch で **INIT エラーなし**  
2. [ ] `apps/qr-attendance` で **`npm run smoke-test`** が **すべて `[PASS]`**  
3. [ ] 本番相当環境では **`SMOKE_PASSWORD`** を CI シークレット等から渡し、リポジトリに残さない  

---

## 5. 関連ドキュメント・コード

- API・インフラ詳細: `apps/qr-attendance/docs/`（例: `ARCHITECTURE.md`, `API.md`, `FIRST_DEPLOY.md`）  
- CDK アプリ: `apps/qr-attendance/infrastructure/cdk/`  
- DB スキーマ: `apps/qr-attendance/database/schema.sql`

---

*最終更新: 502 / ImportModuleError 対応および外向きスモークテスト導入を反映。*
