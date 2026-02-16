# API仕様書

## 概要

QRコード打刻システムのREST API仕様です。

## ベースURL

- 開発環境: `https://api-dev.example.com`
- 本番環境: `https://api.example.com`

## 認証

すべてのAPIリクエストには認証トークンが必要です（ログインAPIを除く）。

```
Authorization: Bearer <token>
```

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
  "userId": "user@example.com",
  "userName": "山田 太郎",
  "orgId": "org001"
}
```

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
  "tel": "090-1234-5678"
}
```

**レスポンス** (201 Created):
```json
{
  "userId": "user@example.com",
  "status": "success"
}
```

---

### 3. マイページ情報取得

**エンドポイント**: `GET /v1/users/me`

**クエリパラメータ**:
- `email` (required): メールアドレス

**レスポンス** (200 OK):
```json
{
  "userId": "user@example.com",
  "userName": "山田 太郎",
  "orgId": "org001",
  "qrCodeData": "base64_encoded_qr_data"
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

### 2. 利用者新規登録（管理者用）

**エンドポイント**: `POST /v1/users/register`

**リクエストボディ**:
```json
{
  "admin_email": "admin@example.com",
  "email": "user@example.com",
  "name_kanji": "山田 太郎",
  "name_kana": "ヤマダ タロウ",
  "password": "password123",
  "tel": "090-1234-5678",
  "address": "東京都...",
  "remarks": "備考"
}
```

**レスポンス** (201 Created):
```json
{
  "userId": "user@example.com",
  "status": "success"
}
```

---

### 3. スタッフ招待

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

---

### 4. イベント作成

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

### 5. レポート出力

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

### 6. お知らせ投稿

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

### 7. スタッフ一覧取得

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

### 1. 打刻処理

**エンドポイント**: `POST /v1/attendance/punch`

**リクエストボディ**:
```json
{
  "qrCodeData": "encoded_qr_data",
  "email": "user@example.com",
  "eventId": 1,
  "staffEmail": "staff@example.com"
}
```

**レスポンス** (200 OK):
```json
{
  "logId": 1,
  "inTime": "2026-01-30T13:30:00Z",
  "outTime": null,
  "status": "entered"
}
```

**レスポンス** (200 OK - 退室時):
```json
{
  "logId": 1,
  "inTime": "2026-01-30T13:30:00Z",
  "outTime": "2026-01-30T15:00:00Z",
  "status": "exited"
}
```

---

## ステータスコード

- `200 OK`: 成功
- `201 Created`: リソース作成成功
- `400 Bad Request`: リクエストエラー
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限エラー
- `404 Not Found`: リソースが見つからない
- `500 Internal Server Error`: サーバーエラー
