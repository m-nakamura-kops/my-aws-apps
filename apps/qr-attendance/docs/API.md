# API仕様書

## 概要

QRコード打刻システムのREST API仕様です。

## ベースURL

- 開発環境: `https://api-dev.example.com`
- 本番環境: `https://api.example.com`

## 認証

ログイン・自己登録以外の API は原則 `Authorization: Bearer <token>` が必要。

```
Authorization: Bearer <token>
```

**パスワードリセットは REST API ではない。** フロント `/login/forgot-password` が Cognito（Amplify `resetPassword` / `confirmResetPassword`）を直接呼び出す。

## エラーレスポンス

```json
{
  "error": "ERROR_CODE",
  "message": "エラーメッセージ",
  "details": {}
}
```

---

## 利用者向けAPI

### 1. 利用者ログイン

**エンドポイント**: `POST /v1/users/login`

**リクエストボディ**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**レスポンス** (200 OK):
```json
{
  "token": "jwt_token_here",
  "refreshToken": "refresh_token_here",
  "userId": "user@example.com",
  "userName": "山田 太郎",
  "orgId": "org001",
  "roleFlag": 1,
  "termsAcceptedAt": "2026-08-23 10:00:00"
}
```

`termsAcceptedAt` は `users.terms_accepted_at`（JST DATETIME）を文字列化した値。未同意のときは `null`。管理者（`roleFlag=3`）以外は、フロントが未同意なら同意画面へ誘導する。

**同期・救済**: Cognito 認証成功後に DB `users` が無ければ Cognito 属性から行を作成する。Cognito にユーザーが無く DB のパスワードが一致する場合は Cognito ユーザーを恒久パスワードで作成/修復して再認証する。片側欠落だけではログイン失敗にしない。

---

### 2. 利用者自己登録

**エンドポイント**: `POST /v1/users/register`

**リクエストボディ**:
```json
{
  "name_kanji": "山田 太郎",
  "name_kana": "ヤマダ タロウ",
  "email": "user@example.com",
  "password": "password123",
  "tel": "090-1234-5678",
  "terms_accepted": true
}
```

`terms_accepted` が `true` でない場合は 400。同意すると `users.terms_accepted_at` に DB の `NOW()`（セッション JST）を記録する。

**レスポンス** (201 Created):
```json
{
  "userId": "user@example.com",
  "status": "success"
}
```

Cognito `SignUp`（必要なら管理者確認）のあと `users` に挿入する。DB 失敗時は Cognito ユーザーを削除してロールバックする。

---

### 3. マイページ情報取得

**エンドポイント**: `GET /v1/users/me`

**認証**: `Authorization: Bearer <token>`

**レスポンス** (200 OK):
```json
{
  "email": "user@example.com",
  "name_kanji": "山田 太郎",
  "name_kana": "ヤマダ タロウ",
  "role_flag": 1,
  "org_id": "org001",
  "terms_accepted_at": "2026-08-23 10:00:00"
}
```

---

### 3b. 利用規約・プライバシーポリシー同意

**エンドポイント**: `POST /v1/users/terms-accept`

**認証**: `Authorization: Bearer <token>`

本文は空でよい。`terms_accepted_at` が NULL のときだけ `NOW()`（JST）で更新する（冪等）。

**レスポンス** (200 OK):
```json
{
  "email": "user@example.com",
  "terms_accepted_at": "2026-08-23 10:00:00",
  "status": "accepted"
}
```

---

### 4. 参加履歴取得

**エンドポイント**: `GET /v1/users/history`

**クエリパラメータ**:
- `email` (required): メールアドレス

**レスポンス** (200 OK):
```json
{
  "history": [
    {
      "eventName": "イベント名",
      "eventDate": "2026-01-30T13:00:00Z",
      "inTime": "2026-01-30T13:30:00Z",
      "outTime": "2026-01-30T15:00:00Z",
      "stayMinutes": 90
    }
  ]
}
```

---

### 5. スケジュール取得

**エンドポイント**: `GET /v1/users/schedule`

**クエリパラメータ**:
- `email` (required): メールアドレス
- `year` (required): 年 (例: 2026)
- `month` (required): 月 (例: 1)

**レスポンス** (200 OK):
```json
{
  "schedule": [
    {
      "date": "2026-01-30",
      "events": [
        {
          "eventName": "イベント名",
          "startTime": "13:00:00"
        }
      ]
    }
  ]
}
```

---

## 管理者向けAPI

### 1. 生徒名簿取得

**エンドポイント**: `GET /v1/admin/students`

**クエリパラメータ**:
- `admin_email` (required): 管理者メールアドレス
- `search` (optional): 検索条件

**レスポンス** (200 OK):
```json
{
  "students": [
    {
      "userId": "user@example.com",
      "name": "山田 太郎",
      "kana": "ヤマダ タロウ",
      "email": "user@example.com",
      "address": "東京都...",
      "tel": "090-1234-5678",
      "registrationDate": "2026-01-01T00:00:00Z",
      "lastAttendanceDate": "2026-01-30T00:00:00Z",
      "remarks": "備考"
    }
  ]
}
```

---

### 2. 生徒一括登録（CSVインポート）

**エンドポイント**: `POST /v1/admin/students/import`

**認証**: 管理者権限必須（クエリ `email` または Authorization ヘッダー）

**リクエストボディ**:
```json
{
  "csv": "email,password,name_kanji,name_kana,tel,org_id,remarks\nuser1@example.com,pass1234,山田 太郎,ヤマダ タロウ,090-1234-5678,ORG01,備考"
}
```

**CSV形式**: 1行目はヘッダー（`email` または「メール」）可。列順: `email`, `password`, `name_kanji`, `name_kana`, `tel`, `org_id`（任意）, `remarks`（任意）。パスワードは8文字以上。ダブルクォートで囲んだ項目内にカンマを含め可能。

**レスポンス** (200 OK):
```json
{
  "imported": 1,
  "totalRows": 2,
  "errors": []
}
```

エラーがある行は `errors` に `{ "row": 行番号, "email": "メール", "message": "エラー内容" }` で返る。

---

### 3. 利用者新規登録（管理者用・生徒招待）

**エンドポイント**: `POST /v1/admin/students`

管理者権限必須。Cognito が未設定の場合は **503**。

**リクエストボディ**:
```json
{
  "email": "user@example.com",
  "name_kanji": "山田 太郎",
  "name_kana": "ヤマダ タロウ",
  "tel": "090-1234-5678",
  "org_id": "ORG01",
  "remarks": "備考"
}
```

パスワードは招待メールの仮パスワードで設定する（リクエストに含めない）。処理順は DB upsert → Cognito `AdminCreateUser`。Cognito 失敗時は DB 行を削除してロールバックする。

**レスポンス** (201 Created):
```json
{
  "email": "user@example.com",
  "status": "success"
}
```

---

### 4. スタッフ招待

**エンドポイント**: `POST /v1/admin/invite`

**リクエストボディ**:
```json
{
  "email": "staff@example.com",
  "role": "staff"
}
```

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "invitationSent": true
}
```

Cognito 招待と DB `users`（`role_flag=2`）をセットで作成する。Cognito 失敗時は DB をロールバックする。

---

### 5. イベント作成

**エンドポイント**: `POST /v1/admin/events`

**リクエストボディ**:
```json
{
  "eventName": "イベント名",
  "eventDate": "2026-01-30T13:00:00Z",
  "location": "会場名",
  "capacity": 100,
  "summary": "イベント概要"
}
```

**レスポンス** (201 Created):
```json
{
  "eventId": 1,
  "status": "success"
}
```

---

### 6. レポート出力

**エンドポイント**: `GET /v1/admin/reports`

**クエリパラメータ**:
- `startDate` (required): 開始日 (YYYY-MM-DD)
- `endDate` (required): 終了日 (YYYY-MM-DD)
- `format` (optional): 形式 (json|csv) デフォルト: json

**レスポンス** (200 OK):
```json
{
  "reports": [
    {
      "logId": 1,
      "userId": "user@example.com",
      "userName": "山田 太郎",
      "eventName": "イベント名",
      "inTime": "2026-01-30T13:30:00Z",
      "outTime": "2026-01-30T15:00:00Z",
      "stayMinutes": 90,
      "method": "QRコード",
      "remarks": "備考",
      "staffEmail": "staff@example.com",
      "staffName": "スタッフ名"
    }
  ]
}
```

---

### 7. お知らせ投稿

**エンドポイント**: `POST /v1/admin/news`

**リクエストボディ**:
```json
{
  "title": "お知らせタイトル",
  "content": "お知らせ内容"
}
```

**レスポンス** (201 Created):
```json
{
  "newsId": 1,
  "status": "success"
}
```

---

### 8. スタッフ一覧取得

**エンドポイント**: `GET /v1/admin/staffs`

**クエリパラメータ**:
- `email` (required): 管理者メールアドレス

**レスポンス** (200 OK):
```json
{
  "staffs": [
    {
      "staffId": "staff@example.com",
      "name": "スタッフ名",
      "kana": "スタッフメイ",
      "email": "staff@example.com",
      "tel": "090-1234-5678",
      "role": "staff",
      "lastLogin": "2026-01-30T10:00:00Z"
    }
  ]
}
```

---

## 打刻API

### 1. QRスキャン打刻

**エンドポイント**: `POST /v1/users/attendance`

スタッフまたは管理者の Authorization 必須。

**リクエストボディ**:
```json
{
  "qr_code_data": "base64_qr_payload",
  "signature": "hmac_sha256_hex",
  "event_id": 1
}
```

**動作（1入退室＝1行）**
- 未退室行（`in_time IS NOT NULL AND out_time IS NULL`）がある → その行の `out_time` のみ UPDATE。`in_time` は変更しない。`out_time = GREATEST(NOW(), in_time)`。
- 無い → `type='entry'` を INSERT（`in_time=NOW()`, `out_time=NULL`）。
- 時刻は DB の `NOW()`（セッション TZ `+09:00` / JST）。Lambda 側の壁時計は使わない。
- 入室後約15秒以内の再スキャンは退室にしない。退室後約15秒以内は新規入室行を作らない。

**レスポンス** (200 OK - 入室):
```json
{
  "log_id": 11,
  "action": "in",
  "in_time": "2026-08-16 10:15:38",
  "message": "入室打刻が完了しました"
}
```

**レスポンス** (200 OK - 退室):
```json
{
  "log_id": 11,
  "action": "out",
  "in_time": "2026-08-16 10:15:38",
  "out_time": "2026-08-16 10:16:23",
  "message": "退室打刻が完了しました"
}
```

---

### 2. 手動打刻

**エンドポイント**: `POST /v1/attendance/manual`

スタッフまたは管理者必須。

**リクエストボディ**:
```json
{
  "event_id": 1,
  "email": "user@example.com",
  "action": "entry"
}
```

`action` は `entry` / `in`（入室）または `exit` / `out`（退室）。退室は未退室行の UPDATE。開いている入室が無い退室は 400。既に未退室の入室がある状態での入室は 409。

---

### 3. 打刻履歴

**エンドポイント**: `GET /v1/users/attendance/history`

`in_time` のある entry 行のみ返す（1入退室＝1レコード）。未設定の時刻は null（フロントは `-` 表示）。

---

## ステータスコード

- `200 OK`: 成功
- `201 Created`: リソース作成成功
- `400 Bad Request`: リクエストエラー
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限エラー
- `404 Not Found`: リソースが見つからない
- `409 Conflict`: 競合（未退室の入室がある状態での再入室など）
- `500 Internal Server Error`: サーバーエラー
- `503 Service Unavailable`: Cognito 未設定など依存サービス不可
