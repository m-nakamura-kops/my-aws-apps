# 結合テスト チェックリスト

QRコード打刻システムの結合テストで、**ユーザー管理・イベント・申込・打刻・履歴**の全機能を網羅するためのチェックリストです。

---

## 前提・環境

- [ ] バックエンド（ローカル API またはデプロイ先）が起動している
- [ ] フロントエンドが起動している（必要に応じて）
- [ ] テスト用DBがマイグレーション済みである
- [ ] 管理者・スタッフ・利用者用のテストアカウントを用意している（または作成手順を実行する）
- [ ] **利用者登録テスト（1.2.1〜1.2.3）**: 1.2.3 用に `it-dup@example.com` をシードで投入済みであること（`npm run seed-test-users`）。1.2.1 は未使用メール（例: it-reg-new@example.com）で新規登録、1.2.2 は不正メール（例: invalidemail）で送信。

---

## 1. ユーザー管理

### 1.1 認証（ログイン・利用者登録）

| # | 項目 | 手順・確認内容 | 結果 |
|---|------|----------------|------|
| 1.1.1 | 利用者ログイン（成功） | `POST /v1/users/login` に email / password を送信。200 で token, userId, userName が返る。 | ☐ |
| 1.1.2 | 利用者ログイン（失敗） | 誤ったパスワードで 401 または 4xx。メール未登録時も適切なエラー。 | ☐ |
| 1.1.3 | 利用者自己登録（成功） | `POST /v1/users/register` に name_kanji, name_kana, email, password, tel を送信。201 で userId / status が返る。 | ☐ |
| 1.1.4 | 利用者登録（バリデーション） | メール形式不正・パスワード8文字未満等で 400 とエラーメッセージ。 | ☐ |
| 1.1.5 | トークンなしで要認証API呼び出し | Authorization なしで要認証APIを呼ぶと 401 または 403。 | ☐ |

### 1.2 生徒管理（管理者）

| # | 項目 | 手順・確認内容 | 結果 |
|---|------|----------------|------|
| 1.2.1 | 生徒一覧取得 | 管理者トークンで `GET /v1/admin/students`。200 で一覧が返る。 | ☐ |
| 1.2.2 | 生徒一件作成 | `POST /v1/admin/students` で新規生徒。201。一覧に反映される。 | ☐ |
| 1.2.3 | 生徒更新 | `PUT /v1/admin/students/{email}` で名前等を更新。一覧・詳細で反映。 | ☐ |
| 1.2.4 | 生徒削除 | `DELETE /v1/admin/students/{email}`。200/204。一覧から消える。 | ☐ |
| 1.2.5 | 生徒CSV一括登録 | `POST /v1/admin/students/import` でCSV（email, password 等）を送信。成功時は created/updated、エラー行は errors で返る。 | ☐ |
| 1.2.6 | 権限チェック | 利用者・スタッフで生徒一覧/作成/更新/削除/import を呼ぶと 403。 | ☐ |

### 1.3 スタッフ管理（管理者）

| # | 項目 | 手順・確認内容 | 結果 |
|---|------|----------------|------|
| 1.3.1 | スタッフ一覧取得 | 管理者トークンで `GET /v1/admin/staffs`。role_flag 含む一覧が返る。 | ☐ |
| 1.3.2 | スタッフ招待 | `POST /v1/admin/invite` で email, role を送信。200。招待済みが一覧に現れる。 | ☐ |
| 1.3.3 | スタッフ権限変更 | `PUT /v1/admin/staffs/{email}` で role_flag（スタッフ/管理者）を変更。一覧の権限表示が変わる。 | ☐ |
| 1.3.4 | スタッフを利用者に変更 | `DELETE /v1/admin/staffs/{email}`。スタッフ一覧から消え、利用者として残る。 | ☐ |
| 1.3.5 | 権限チェック | 利用者でスタッフ一覧/招待/更新/削除を呼ぶと 403。 | ☐ |

---

## 2. イベント

### 2.1 イベント一覧・公開API

| # | 項目 | 手順・確認内容 | 結果 |
|---|------|----------------|------|
| 2.1.1 | イベント一覧（認証ユーザー） | 利用者またはスタッフ・管理者で `GET /v1/events`。200 でイベント一覧が返る。 | ☐ |
| 2.1.2 | イベント一覧の内容 | イベント名・日時・会場・定員・概要等が含まれる。 | ☐ |

### 2.2 イベント管理（管理者）

| # | 項目 | 手順・確認内容 | 結果 |
|---|------|----------------|------|
| 2.2.1 | 管理用イベント一覧 | `GET /v1/admin/events`。200 で一覧。 | ☐ |
| 2.2.2 | イベント作成 | `POST /v1/admin/events` で eventName, eventDate, location, capacity, summary。201 で eventId が返る。 | ☐ |
| 2.2.3 | イベント更新 | `PUT /v1/admin/events/{eventId}` で内容変更。一覧・詳細で反映。 | ☐ |
| 2.2.4 | イベント削除 | `DELETE /v1/admin/events/{eventId}`。一覧から消える。 | ☐ |
| 2.2.5 | イベントQR取得 | `GET /v1/admin/events/{eventId}/qr`。200 でQR用データ（画像URL等）が返る。 | ☐ |
| 2.2.6 | 参加者一覧取得 | `GET /v1/admin/events/{eventId}/participants`。スタッフ/管理者は全参加者、利用者は自分のみ（権限マトリクス通り）。 | ☐ |
| 2.2.7 | 出席レポート取得 | 管理者で `GET /v1/admin/events/{eventId}/attendance-report`。200 でレポートデータが返る。 | ☐ |
| 2.2.8 | 権限チェック | 利用者で admin/events の作成/更新/削除/QR/participants/attendance-report を呼ぶと 403（participants は自分のみ可の場合は 200）。 | ☐ |

---

## 3. 申込

| # | 項目 | 手順・確認内容 | 結果 |
|---|------|----------------|------|
| 3.1 | イベント参加申込 | 利用者トークンで `POST /v1/users/events/{eventId}/register`。200/201。参加者一覧に現れる。 | ☐ |
| 3.2 | 申込取消 | `DELETE /v1/users/events/{eventId}/register`。200。参加者一覧から消える。 | ☐ |
| 3.3 | 申込一覧取得 | `GET /v1/users/registrations`。200 で自分の申込一覧が返る。 | ☐ |
| 3.4 | 未認証・他ユーザー | トークンなしや別ユーザーで申込/取消/一覧が適切に拒否される。 | ☐ |
| 3.5 | 存在しないイベント | 存在しない eventId で申込/取消すると 404 等。 | ☐ |

---

## 4. 打刻

| # | 項目 | 手順・確認内容 | 結果 |
|---|------|----------------|------|
| 4.1 | QR打刻（POST） | `POST /v1/users/attendance` で eventId 等を送信。200 で打刻成功。 | ☐ |
| 4.2 | QR打刻（GET・URLパラメータ） | `GET /v1/users/attendance?eventId=1&token=...` 等で打刻。200。 | ☐ |
| 4.3 | 打刻の重複・制限 | 同一イベントで入退場が正しく記録される（または仕様どおりの制限がある）。 | ☐ |
| 4.4 | マイQR取得 | `GET /v1/users/me/qr`。200 でQR用データが返る。認証必須。 | ☐ |
| 4.5 | 未認証・未申込 | トークンなしや未申込イベントで打刻すると 401/403/400 等。 | ☐ |

---

## 5. 履歴

| # | 項目 | 手順・確認内容 | 結果 |
|---|------|----------------|------|
| 5.1 | 打刻履歴取得 | `GET /v1/users/attendance/history`（email またはトークンで本人指定）。200 で自分の履歴一覧が返る。 | ☐ |
| 5.2 | 履歴の内容 | イベント名・日時・入退場時刻・滞在時間等が含まれる。 | ☐ |
| 5.3 | 他人の履歴 | 利用者が他人の email で履歴を取得できない（自分のみ返る）。 | ☐ |
| 5.4 | スタッフ・管理者 | スタッフ/管理者でも自分の履歴のみ取得する（仕様が「自分のみ」の場合）。 | ☐ |

---

## 6. エンドポイント一覧（参照用）

| 機能 | メソッド | パス | 備考 |
|------|----------|------|------|
| ログイン | POST | /v1/users/login | |
| 利用者登録 | POST | /v1/users/register | |
| 生徒一覧 | GET | /v1/admin/students | 管理者 |
| 生徒作成 | POST | /v1/admin/students | 管理者 |
| 生徒更新 | PUT | /v1/admin/students/{email} | 管理者 |
| 生徒削除 | DELETE | /v1/admin/students/{email} | 管理者 |
| 生徒CSV取込 | POST | /v1/admin/students/import | 管理者 |
| スタッフ一覧 | GET | /v1/admin/staffs | 管理者 |
| スタッフ招待 | POST | /v1/admin/invite | 管理者 |
| スタッフ更新 | PUT | /v1/admin/staffs/{email} | 管理者 |
| スタッフ削除 | DELETE | /v1/admin/staffs/{email} | 管理者 |
| イベント一覧 | GET | /v1/events | 認証ユーザー |
| 管理イベント一覧 | GET | /v1/admin/events | 管理者 |
| イベント作成 | POST | /v1/admin/events | 管理者 |
| イベント更新 | PUT | /v1/admin/events/{eventId} | 管理者 |
| イベント削除 | DELETE | /v1/admin/events/{eventId} | 管理者 |
| イベントQR | GET | /v1/admin/events/{eventId}/qr | 管理者 |
| 参加者一覧 | GET | /v1/admin/events/{eventId}/participants | スタッフ/管理者（利用者は自分のみ） |
| 出席レポート | GET | /v1/admin/events/{eventId}/attendance-report | 管理者 |
| 参加申込 | POST | /v1/users/events/{eventId}/register | 利用者 |
| 申込取消 | DELETE | /v1/users/events/{eventId}/register | 利用者 |
| 申込一覧 | GET | /v1/users/registrations | 利用者 |
| 打刻 | POST / GET | /v1/users/attendance | 利用者 |
| マイQR | GET | /v1/users/me/qr | 利用者 |
| 打刻履歴 | GET | /v1/users/attendance/history | 利用者（自分のみ） |

---

## 7. シナリオテスト（推奨）

以下のエンドツーエンドシナリオを通しで実行すると、結合の信頼性が上がります。

| # | シナリオ | 手順 | 結果 |
|---|----------|------|------|
| S1 | 利用者登録→ログイン→イベント一覧→申込→打刻→履歴確認 | 1. 利用者登録 2. ログイン 3. GET /v1/events 4. POST register 5. POST attendance 6. GET attendance/history で履歴に打刻が含まれる | ☐ |
| S2 | 管理者でイベント作成→QR取得→参加者確認→出席レポート | 1. 管理者ログイン 2. POST admin/events 3. GET .../qr 4. 利用者が申込・打刻 5. GET participants 6. GET attendance-report | ☐ |
| S3 | 生徒CSV取込→スタッフ招待→権限変更→利用者に変更 | 1. 管理者で CSV import 2. invite 3. PUT staff role 4. DELETE staff で一覧から消え利用者のみ残る | ☐ |

---

## 結果サマリ（記入用）

| カテゴリ | 項目数 | 合格 | 不合格 | 未実施 |
|----------|--------|------|--------|--------|
| 1. ユーザー管理 | 16 | | | |
| 2. イベント | 10 | | | |
| 3. 申込 | 5 | | | |
| 4. 打刻 | 5 | | | |
| 5. 履歴 | 4 | | | |
| 6. シナリオ | 3 | | | |
| **合計** | **43** | | | |

---

- 実施日: _______________
- 実施者: _______________
- 環境: ☐ ローカル  ☐ 開発  ☐ 本番
- 備考: _______________
