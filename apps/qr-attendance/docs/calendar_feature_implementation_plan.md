# カレンダー機能（No.10.1.1, 10.1.2）実装計画

## 1. 前提・設計の注意点

- **events テーブル**: 既存定義の `event_name`, `event_date` をそのまま使用する。
- **公開条件**: 仕様では「公開済み (published_at ≦ NOW)」とあるが、**現行 schema の events には `published_at` がない**。  
  - **案A（推奨）**: マイグレーションで `events.published_at` を追加し、未設定は `NULL` または `created_at` 相当で「公開済み」扱いにする。  
  - **案B**: 列を増やさず、当月のイベントを「すべて公開済み」として返す（`published_at` 条件なし）。
- **start_time**: 現行は `event_date` (DATETIME) のみ。並び順は `event_date` の昇順とする（必要なら後から `start_time` を追加可能）。

---

## 2. API エンドポイント設計案

### ① GET /v1/calendar（全体用）

| 項目 | 内容 |
|------|------|
| **パス** | `GET /v1/calendar` |
| **認証** | 要ログイン（利用者・スタッフ・管理者いずれも可） |
| **クエリ** | `month`（任意）。形式 `YYYY-MM`（例: 2026-04）。省略時は**当月**。 |
| **表示条件** | ・`events.published_at` ≦ 現在時刻（列がある場合）<br>・`event_date` が指定月の初日 00:00:00 ～ 末日 23:59:59 の範囲 |
| **並び順** | `event_date` 昇順（`start_time` は現状未実装のため省略） |
| **レスポンス例** | `{ "events": [ { "event_id", "event_name", "event_date", "location", "capacity", "summary" } ], "month": "2026-04" }` |

### ② GET /v1/users/schedule（自分用）

| 項目 | 内容 |
|------|------|
| **パス** | `GET /v1/users/schedule` |
| **認証** | 要ログイン（自分のスケジュールのみ） |
| **クエリ** | `month`（任意）。形式 `YYYY-MM`。省略時は**当月**。 |
| **ロジック** | ・自分が申し込んでいるイベントを `registrations` から抽出<br>・`attendance_logs` と照合し、打刻があれば `is_attended: true`<br>・`is_registered` は申込があるため常に `true`（申込一覧であるため） |
| **レスポンス例** | `{ "schedule": [ { "event_id", "event_name", "event_date", "is_registered": true, "is_attended": true/false } ], "month": "2026-04" }` |

---

## 3. 月パラメータ（YYYY-MM）の扱い

`month` が `"2026-04"` のような文字列で渡される前提。

- **初日**: その月の 1 日 00:00:00（UTC かローカルかは DB の DATETIME 方針に合わせる）。  
- **末日**: その月の最終日 23:59:59。  
- タイムゾーンはサーバー／DB と合わせる（例: 日本なら `Asia/Tokyo` で月初・月末を計算する）。

### ロジック例（Node.js）

```javascript
function getMonthRange(monthStr) {
  // monthStr: "YYYY-MM" または undefined（当月）
  const now = new Date();
  const year = monthStr ? parseInt(monthStr.slice(0, 4), 10) : now.getFullYear();
  const month = monthStr ? parseInt(monthStr.slice(5, 7), 10) - 1 : now.getMonth(); // 0-indexed

  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999); // 翌月0日 = 当月最終日

  // MySQL DATETIME 用文字列（ローカルまたは ISO に合わせる）
  const startStr = start.toISOString().slice(0, 19).replace('T', ' ');
  const endStr = end.toISOString().slice(0, 19).replace('T', ' ');
  return { startStr, endStr, start, end };
}
```

- バリデーション: `month` がある場合は正規表現で `^\d{4}-\d{2}$` をチェックし、不正なら 400 を返す。

### WHERE 句への渡し方

- プレースホルダで `event_date BETWEEN ? AND ?` に `startStr`, `endStr` を渡す（SQL インジェクション対策）。
- DB の `event_date` が DATETIME でタイムゾーンを持たない場合は、サーバーで「業務タイムゾーン（例: JST）」で上記の `start` / `end` を決め、そのまま `startStr` / `endStr` にするか、UTC で統一するかはプロジェクト方針に合わせる。

---

## 4. 3 テーブル JOIN の SQL 案（GET /v1/users/schedule）

自分（`?` = ログインユーザーの email）の「申込イベント」について、`registrations` と `attendance_logs` を組み合わせ、`is_registered` / `is_attended` を付ける。

### 案1: 申込を基準に LEFT JOIN で打刻の有無を見る

```sql
SELECT
  e.event_id,
  e.event_name,
  e.event_date,
  e.location,
  e.capacity,
  e.summary,
  1 AS is_registered,
  CASE WHEN al.log_id IS NOT NULL THEN 1 ELSE 0 END AS is_attended
FROM registrations r
INNER JOIN events e ON e.event_id = r.event_id
LEFT JOIN attendance_logs al ON al.event_id = r.event_id AND al.email = r.email
WHERE r.email = ?
  AND e.event_date BETWEEN ? AND ?
ORDER BY e.event_date ASC;
```

- `registrations` に存在する = 申込済みなので `is_registered` は常に 1。  
- `attendance_logs` に同じ (event_id, email) があれば `is_attended` を 1、なければ 0。  
- 月範囲は `BETWEEN ? AND ?` に上記の `startStr`, `endStr` を渡す。

### 案2: 打刻をサブクエリで存在判定（1 行 1 イベントにしたい場合）

同じ意味で、`EXISTS` を使う例。

```sql
SELECT
  e.event_id,
  e.event_name,
  e.event_date,
  e.location,
  e.capacity,
  e.summary,
  1 AS is_registered,
  EXISTS (
    SELECT 1 FROM attendance_logs al
    WHERE al.event_id = r.event_id AND al.email = r.email
  ) AS is_attended
FROM registrations r
INNER JOIN events e ON e.event_id = r.event_id
WHERE r.email = ?
  AND e.event_date BETWEEN ? AND ?
ORDER BY e.event_date ASC;
```

- MySQL では `EXISTS` の結果を 0/1 で返すので、そのまま `is_attended` に使える。  
- 1 イベント 1 行で、重複なし。

### 推奨

- **実装の分かりやすさ**: 案1（LEFT JOIN）で十分。  
- **行の一意性**: 同一 (event_id, email) の打刻が複数ある場合は案1で行が複数になるため、`GROUP BY e.event_id` して `MAX(CASE WHEN al.log_id IS NOT NULL THEN 1 ELSE 0 END)` で `is_attended` をまとめてもよい。通常は 1 イベント 1 打刻なら案1のままでよい。

---

## 5. GET /v1/calendar 用 SQL 案（events のみ）

「公開済み」かつ「指定月の event_date」のイベント一覧。

### events に published_at がある場合（案A）

```sql
SELECT event_id, event_name, event_date, location, capacity, summary
FROM events
WHERE (published_at IS NULL OR published_at <= ?)
  AND event_date BETWEEN ? AND ?
ORDER BY event_date ASC;
```

- 第1引数: 現在時刻（DATETIME 文字列）。  
- 第2・3引数: 上記の月範囲 `startStr`, `endStr`。

### events に published_at がない場合（案B）

```sql
SELECT event_id, event_name, event_date, location, capacity, summary
FROM events
WHERE event_date BETWEEN ? AND ?
ORDER BY event_date ASC;
```

- 第1・2引数: 月範囲の `startStr`, `endStr` のみ。

---

## 6. 実装タスク一覧（案）

1. **スキーマ**  
   - （案A を採用する場合）マイグレーションで `events.published_at` を追加（NULL 許容または DEFAULT 現在時刻）。

2. **GET /v1/calendar**  
   - ハンドラ追加（例: `functions/calendar/list/index.js`）。  
   - 認証: ログイン済みユーザーであれば誰でも可。  
   - `month` の検証と上記の月範囲計算。  
   - 上記の calendar 用 SQL を実行し、`events` と `month` を返す。

3. **GET /v1/users/schedule**  
   - ハンドラ追加（例: `functions/users/schedule/index.js`）。  
   - 認証: 自分の email のみ（トークンから取得）。  
   - `month` の検証と月範囲計算。  
   - 上記の 3 テーブル JOIN（案1 または 案2）を実行し、`schedule` と `month` を返す。  
   - レスポンスの `is_registered` / `is_attended` は SQL の 0/1 を boolean に変換して返す。

4. **ルーティング**  
   - `local-server.ts` に `GET /v1/calendar` と `GET /v1/users/schedule` を登録。

5. **結合テスト**  
   - No.10.1.1（カレンダー取得）・10.1.2（スケジュール取得）のケースを実装し、OK になることを確認。

---

## 7. 確認事項への回答まとめ

| 確認事項 | 回答 |
|----------|------|
| 3 テーブル JOIN の SQL 案 | 上記「4. 3 テーブル JOIN の SQL 案」の案1（LEFT JOIN）または案2（EXISTS）。`registrations` 基準で `events` と `attendance_logs` を結合し、`is_registered` / `is_attended` を付与。 |
| month（YYYY-MM）の初日・末日の扱い | 上記「3. 月パラメータの扱い」のとおり。`new Date(year, month, 1, 0, 0, 0, 0)` で初日、`new Date(year, month + 1, 0, 23, 59, 59, 999)` で末日を算出し、DATETIME 用文字列に変換して `BETWEEN ? AND ?` に渡す。 |

以上を実装案として進めれば、既存の `event_name` / `event_date` を崩さずに、カレンダー（10.1.1）とスケジュール（10.1.2）の両方を実装できます。
