# QRコード打刻システム アーキテクチャ詳細

## システムアーキテクチャ

### 全体構成

```
┌─────────────────────────────────────────────────────────────┐
│                        クライアント層                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Web Browser / Smartphone                            │  │
│  │  - Next.js アプリケーション                           │  │
│  │  - QRコードスキャン機能                               │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬───────────────────────────────────────┘
                        │ HTTPS
                        │
        ┌───────────────▼────────────────┐
        │     AWS Amplify Hosting        │
        │  - CDN配信                      │
        │  - SSL/TLS終端                 │
        │  - 自動スケーリング             │
        └───────────────┬────────────────┘
                        │
        ┌───────────────▼────────────────┐
        │     Amazon Cognito              │
        │  - ユーザー認証                 │
        │  - セッション管理               │
        │  - JWTトークン発行              │
        └───────────────┬────────────────┘
                        │
        ┌───────────────▼────────────────┐
        │     API Gateway                │
        │  - REST API                    │
        │  - リクエストルーティング        │
        │  - レート制限                   │
        │  - CORS設定                    │
        └───────────────┬────────────────┘
                        │
        ┌───────────────▼────────────────┐
        │     AWS Lambda                 │
        │  ┌──────────────────────────┐  │
        │  │ 認証関数                 │  │
        │  │ ユーザー管理関数          │  │
        │  │ イベント管理関数          │  │
        │  │ 打刻処理関数              │  │
        │  │ 管理者機能関数            │  │
        │  └──────────────────────────┘  │
        └───────────────┬────────────────┘
                        │
        ┌───────────────▼────────────────┐
        │     Amazon RDS                 │
        │  - MySQL/MariaDB                │
        │  - マルチAZ配置                 │
        │  - 自動バックアップ             │
        └────────────────────────────────┘
```

## データフロー

### 1. ユーザーログイン（Cognito と DB の相互補完）

```
1. フロント → API Gateway: POST /v1/users/login
2. Lambda → Cognito: InitiateAuth（USER_PASSWORD_AUTH）
3. 成功時、DB に users 行が無ければ Cognito 属性から users を自動作成
4. Cognito にユーザーが無い（または認証失敗）が DB に行がありパスワードが一致する場合:
   Cognito ユーザーを恒久パスワードで作成/修復してから再認証
5. Lambda → クライアント: JWT（または API トークン）+ ユーザー情報（`termsAcceptedAt` を含む）
```

フロントは Amplify `signIn` を優先し、Cognito 側にユーザーが無い場合は上記 API ログインで救済したうえで再 signIn する。

管理者以外（生徒・保護者・スタッフ）で `users.terms_accepted_at` が NULL の場合、フロントは `/consent` で同意を求め、`POST /v1/users/terms-accept` が DB の `NOW()`（JST）を記録してからホームへ進む。公開ページ `/terms` `/privacy` は未ログインでも閲覧できる。

### 1b. 招待・自己登録（アトミック作成）

- **生徒招待** `POST /v1/admin/students`: DB `users` を upsert したうえで Cognito `AdminCreateUser`（招待メール）。Cognito 失敗時は DB 行をロールバックする。
- **スタッフ招待** `POST /v1/admin/invite`: 同様に Cognito 招待と DB 挿入をセットで行い、失敗時はロールバックする。
- **自己登録** `POST /v1/users/register`: Cognito `SignUp` + 管理者確認のあと DB 挿入。`terms_accepted=true` 必須。DB 失敗時は Cognito ユーザーを削除する。
- 共通実装は `backend/shared/utils/cognito-db-sync.ts`。Cognito 未設定時は招待 API は 503。
- **同意記録**: `users.terms_accepted_at`（マイグレーション 009）。自己登録・初回パスワード設定後の同意 API・ログイン後ガードから `NOW()` を書き込む。

### 1c. パスワードリセット（フロント → Cognito 直接）

管理者 API は経由しない。ログイン画面 `/login/forgot-password` が Amplify の `resetPassword`（ForgotPassword）と `confirmResetPassword`（ConfirmForgotPassword）を呼ぶ。User Pool の `accountRecovery` は EMAIL_ONLY。リセットには `email_verified=true` が必要。

### 2. QRコード打刻（1入退室＝1行）

```
1. スタッフ → Amplify: 利用者QRをスキャン（イベント選択済み）
2. Amplify → API Gateway: POST /v1/users/attendance
   body: qr_code_data, signature, event_id
3. Lambda:
   - HMAC 署名と QR 有効期限を検証
   - 未申込なら registrations に walk-in 登録
   - 未退室行（in_time IS NOT NULL AND out_time IS NULL）があれば退室 UPDATE
   - 無ければ入室 INSERT（type='entry', in_time=NOW(), out_time=NULL）
4. レスポンス: log_id, action ('in'|'out'), in_time, out_time, message
```

**時刻**: Lambda の `new Date()` は打刻時刻に使わない。MySQL 接続は `timezone: '+09:00'` かつ `SET time_zone = '+09:00'`。入退室はいずれも DB の `NOW()`。退室は `out_time = GREATEST(NOW(), in_time)` とし、`in_time` は上書きしない。

**連打防止**: 入室から約15秒以内の再スキャンは退室にしない。退室から約15秒以内の再スキャンは新規入室 INSERT しない。

手動打刻は `POST /v1/attendance/manual`（`action=entry|exit`）。退室は同様に未退室行の UPDATE。

## データベース（打刻）

### attendance_logs（マイグレーション 006 以降）

| カラム | 内容 |
|--------|------|
| log_id | PK |
| email, event_id | 対象利用者・イベント |
| type | `entry`（現行モデルでは1セッション1行。過去の分割 `exit` 行は修復対象） |
| in_time | 入室時刻（JST DATETIME）。NULL 不可の運用（entry 行） |
| out_time | 退室時刻。未退室は NULL |
| staff_email | 打刻担当 |
| notes | 手動打刻などの備考（任意） |

ビュー `v_attendance_details` は `in_time IS NOT NULL` かつ `type` が NULL/空/`entry` の行を1入退室として返す（`stay_minutes = TIMESTAMPDIFF(MINUTE, in_time, out_time)`）。

参加者一覧は **最新の打刻行1件** の `in_time` / `out_time` を対で返す（別行の `MAX(out_time)` と混ぜない）。API は JST 壁時計を `+09:00` 付き ISO8601 で返す。

## セキュリティアーキテクチャ

### 認証・認可

1. **Cognito User Pool**: ユーザー認証
2. **JWTトークン**: API認証
3. **IAMロール**: Lambda実行権限
4. **VPC**: データベースアクセス制限
5. **セキュリティグループ**: ネットワークアクセス制御

### データ保護

1. **暗号化**: 
   - 転送時: TLS/SSL
   - 保存時: RDS暗号化
2. **パスワード**: Cognitoでハッシュ化
3. **機密情報**: AWS Secrets Managerで管理

## スケーラビリティ

### フロントエンド
- Amplify CDNによるグローバル配信
- 自動スケーリング

### バックエンド
- Lambda自動スケーリング
- API Gatewayスロットリング設定
- RDS読み取りレプリカ（必要に応じて）

### データベース
- RDS自動スケーリング
- 接続プーリング
- インデックス最適化

## 監視・ログ

### CloudWatch
- Lambda実行ログ
- API Gatewayアクセスログ
- RDSメトリクス
- カスタムメトリクス

### アラート
- エラー率
- レスポンス時間
- データベース接続数
- ディスク使用率

## 災害復旧

### バックアップ
- RDS自動バックアップ（日次）
- ポイントインタイムリカバリ
- クロスリージョンレプリカ（オプション）

### 可用性
- マルチAZ配置
- 自動フェイルオーバー

## コスト最適化

### Lambda
- 適切なメモリ設定
- プロビジョンド同時実行数（必要に応じて）

### RDS
- 適切なインスタンスサイズ
- 自動停止（開発環境）

### API Gateway
- キャッシュ設定（可能な場合）

## 開発・デプロイフロー

```
開発者
  ↓
ローカル開発環境
  ↓
GitHub (コード管理)
  ↓
GitHub Actions (CI/CD)
  ↓
AWS環境
  ├─ Amplify (フロントエンド)
  ├─ Lambda (バックエンド)
  └─ RDS (データベース)
```

## 技術スタック詳細

### フロントエンド
- **Next.js 14+**: SSR/SSG対応
- **React 18+**: UIライブラリ
- **TypeScript**: 型安全性
- **Tailwind CSS**: スタイリング
- **AWS Amplify UI**: UIコンポーネント

### バックエンド
- **Node.js 18+**: ランタイム
- **TypeScript**: 型安全性
- **AWS Lambda**: サーバーレス実行
- **API Gateway**: REST API

### データベース
- **MySQL 8.0+ / MariaDB 10.6+**: RDBMS
- **接続プーリング**: mysql2

### インフラ
- **AWS CDK**: Infrastructure as Code
- **CloudFormation**: リソース管理

## パフォーマンス目標

- APIレスポンス時間: < 500ms (p95)
- ページロード時間: < 2秒
- データベースクエリ: < 100ms (p95)
- 可用性: 99.9%
