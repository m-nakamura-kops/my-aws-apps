# レポート機能 No.8.1.1 実装方針案

## 要件整理

| 項目 | 内容 |
|------|------|
| **エンドポイント** | `GET /v1/admin/reports/events/{event_id}/csv` |
| **権限** | 管理者（Admin, role_flag=3）のみ。スタッフは不可。 |
| **主軸** | registrations。users と attendance_logs を JOIN。 |
| **打刻なし** | attendance_logs にデータがない場合は「打刻日時」を空（欠席扱い）。 |

---

## 1. SQL クエリ案

### 1.1 テーブル・カラム対応

- **registrations**: 申込一覧の主軸。`event_id`, `email`, `created_at`（申込日時）
- **events**: `event_id`, `event_name`, `event_date`（開催日）
- **users**: `name_kanji`, `name_kana`, `email`, `role_flag`（→ 区分）
- **attendance_logs**: 打刻ありなら `in_time` を「打刻日時（実績）」として使用。**LEFT JOIN** で紐付け、無ければ NULL。

同一 (event_id, email) で複数打刻がある場合は **1行1申込者** にしたいため、打刻は「そのイベント・メールの最新 1 件」に集約する。

### 1.2 推奨 SQL（サブクエリで打刻を集約）

```sql
SELECT
  e.event_id,
  e.event_date,
  e.event_name,
  u.name_kanji,
  u.name_kana,
  u.email,
  CASE WHEN u.role_flag = 1 THEN '生徒' ELSE '一般' END AS category,
  r.created_at AS registration_date,
  al.in_time AS attendance_time
FROM registrations r
INNER JOIN events e ON e.event_id = r.event_id
INNER JOIN users u ON u.email = r.email
LEFT JOIN (
  SELECT event_id, email, MAX(in_time) AS in_time
  FROM attendance_logs
  GROUP BY event_id, email
) al ON al.event_id = r.event_id AND al.email = r.email
WHERE r.event_id = ?
ORDER BY r.created_at ASC;
```

- **パラメータ**: `?` に path の `event_id` をバインド。
- **区分**: `role_flag = 1`（利用者）→「生徒」、それ以外（スタッフ・管理者）→「一般」。
- **打刻日時**: 打刻ありなら `al.in_time`、なしなら NULL。CSV では NULL は空欄で出力。

### 1.3 代替案（LEFT JOIN のみ・1打刻前提）

1 イベント 1 人あたり 1 打刻のみと割り切る場合は以下でも可。

```sql
SELECT
  e.event_id,
  e.event_date,
  e.event_name,
  u.name_kanji,
  u.name_kana,
  u.email,
  CASE WHEN u.role_flag = 1 THEN '生徒' ELSE '一般' END AS category,
  r.created_at AS registration_date,
  al.in_time AS attendance_time
FROM registrations r
INNER JOIN events e ON e.event_id = r.event_id
INNER JOIN users u ON u.email = r.email
LEFT JOIN attendance_logs al ON al.event_id = r.event_id AND al.email = r.email
WHERE r.event_id = ?
ORDER BY r.created_at ASC;
```

複数打刻があると申込者 1 人につき複数行になるため、**1 行 1 申込者**を厳密にするなら上記 1.2 のサブクエリ案を推奨。

---

## 2. CSV 出力仕様

### 2.1 列順（ヘッダー含む）

| # | ヘッダー名 | 取得元 |
|---|------------|--------|
| 1 | イベントID | `e.event_id` |
| 2 | 開催日 | `e.event_date` |
| 3 | イベント名 | `e.event_name` |
| 4 | 利用者名 | `u.name_kanji` |
| 5 | ふりがな | `u.name_kana` |
| 6 | メールアドレス | `u.email` |
| 7 | 区分（生徒/一般） | `category`（上記 CASE 式） |
| 8 | 申込日時 | `r.created_at` |
| 9 | 打刻日時（実績） | `al.in_time`（NULL なら空） |

### 2.2 フォーマット

- **区切り**: カンマ (`,`)
- **改行**: LF (`\n`)
- **囲み**: フィールドにカンマ・改行・ダブルクォートが含まれる場合は RFC 4180 に従いダブルクォートで囲み、内部の `"` は `""` にエスケープ。

---

## 3. BOM 付き UTF-8 の実現方法

日本語環境の Excel で文字化けしないよう、**BOM 付き UTF-8** で出力する。

### 3.1 Node.js での実装

- **BOM**: U+FEFF。UTF-8 のバイト列は `0xEF, 0xBB, 0xBF`。
- **方法 1（文字列）**: CSV 本文を `csvContent` とすると、  
  `body = '\uFEFF' + csvContent`  
  でレスポンス body に設定。Lambda の `body` は文字列のまま返してよい（API Gateway がそのままクライアントに渡す）。
- **方法 2（Buffer）**:  
  `body = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(csvContent, 'utf8')]).toString('utf8')`  
  とすると BOM + UTF-8 の文字列になる。通常は **方法 1** で十分。

### 3.2 実装例（ハンドラ内）

```javascript
const BOM = '\uFEFF';
const headerRow = 'イベントID,開催日,イベント名,利用者名,ふりがな,メールアドレス,区分（生徒/一般）,申込日時,打刻日時（実績）';
const rows = queryResult.map(r => [
  r.event_id,
  formatDateTime(r.event_date),
  escapeCsvField(r.event_name),
  escapeCsvField(r.name_kanji),
  escapeCsvField(r.name_kana),
  escapeCsvField(r.email),
  r.category,
  formatDateTime(r.registration_date),
  r.attendance_time ? formatDateTime(r.attendance_time) : '',
].join(','));
const csvContent = [headerRow, ...rows].join('\n');
const body = BOM + csvContent;
```

- `escapeCsvField`: カンマ・改行・`"` を含む場合は `"` で囲み、`"` → `""`。
- `formatDateTime`: DB の DATETIME をそのまま文字列で出力するか、例: `YYYY-MM-DD HH:mm:ss` 形式に整形。

---

## 4. レスポンスヘッダー

| ヘッダー | 値 |
|----------|-----|
| **Content-Type** | `text/csv; charset=utf-8` |
| **Content-Disposition** | ダウンロード用。ファイル名にイベント名・日付を含める。 |

### 4.1 Content-Disposition のファイル名

- **ASCII のみ（安全）**:  
  `attachment; filename="event_attendees_${event_id}_${dateOnly}.csv"`  
  例: `event_attendees_5_2026-03-15.csv`（event_date の日付部分を使用）
- **日本語を含める場合（RFC 5987）**:  
  `attachment; filename="event_attendees_5_2026-03-15.csv"; filename*=UTF-8''%E5%87%BA%E5%B8%AD%E8%80%85%E4%B8%80%E8%A6%A7.csv`  
  など。実装ではまず ASCII のみのファイル名でよい。

### 4.2 Lambda 戻り値の例

```javascript
return {
  statusCode: 200,
  headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="event_attendees_${eventId}_${dateStr}.csv"`,
    'Access-Control-Allow-Origin': '*',
    // ...
  },
  body: BOM + csvContent,
};
```

---

## 5. 権限・エラー処理

- **認証**: `getUserEmailFromRequest(event)` でメール取得。未認証なら 401。
- **権限**: `checkAdminPermission(event)` を使用。**管理者（role_flag=3）のみ**許可し、スタッフは 403。
- **event_id**: path から取得。不正・未指定なら 400。
- **イベント不在**: 上記 SQL の前に `SELECT event_id, event_name, event_date FROM events WHERE event_id = ?` で存在確認。0 件なら 404。

---

## 6. 実装タスク一覧（案）

1. **ハンドラ追加**  
   - 例: `functions/admin/reports/events/csv/index.ts`（または `functions/admin/reports/events-csv/index.ts`）
2. **管理者チェック**  
   - `checkAdminPermission` で Admin のみ許可。
3. **イベント取得・存在確認**  
   - event_id で 1 件取得。ファイル名用に event_name, event_date を保持。
4. **上記 SQL 実行**  
   - サブクエリ版で 1 行 1 申込者＋打刻日時（NULL 時は空）を取得。
5. **CSV 生成**  
   - ヘッダー＋データ行。RFC 4180 のエスケープ。先頭に `\uFEFF` を付与。
6. **レスポンス返却**  
   - 200, Content-Type: text/csv; charset=utf-8, Content-Disposition, body = BOM + CSV。
7. **local-server.ts**  
   - `GET:/v1/admin/reports/events/{eventId}/csv` を上記ハンドラにマッピング。

---

## 7. 確認事項

| 確認事項 | 案 |
|----------|-----|
| 区分「生徒/一般」の定義 | role_flag=1 → 生徒、2/3 → 一般。 |
| 複数打刻時の扱い | サブクエリで MAX(in_time) を取り 1 行 1 申込者に集約。 |
| ファイル名 | ASCII のみ: `event_attendees_{event_id}_{YYYY-MM-DD}.csv`。 |
| BOM | レスポンス body の先頭に `'\uFEFF' + csvContent` で付与。 |

以上を実装方針案とする。
