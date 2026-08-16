# 手動打刻フロー実装案（11.1.2, 11.1.3, 11.1.4）

## 要件整理

| 項目 | 内容 |
|------|------|
| **生徒検索** | GET /v1/students/search。クエリ `q` で name_kanji / name_kana の部分一致。権限: 管理者(3) または スタッフ(2)。返却: user_id, name_kanji, name_kana, email。 |
| **手動打刻実行** | POST /v1/attendance/manual。event_id と email（または user_id）を受け取り attendance_logs に挿入。手動フラグまたは備考で「手動打刻」を記録。権限: 管理者(3) または スタッフ(2)。 |

---

## 1. 生徒検索 (GET /v1/students/search)

### 1.1 SQL クエリ案

漢字・ふりがなの**部分一致**で、**生徒（利用者）のみ**に絞る場合の例です。  
`users` の主キーは `email` のため、レスポンスの `user_id` には `email` をそのまま返す想定です。

```sql
SELECT email, name_kanji, name_kana, email AS user_id
FROM users
WHERE role_flag = 1
  AND (name_kanji LIKE ? OR name_kana LIKE ?)
ORDER BY name_kana ASC
LIMIT 50;
```

- **プレースホルダ**: `?` に `%キーワード%` を 2 つ渡す（1 つ目が name_kanji、2 つ目が name_kana 用）。
- **例**: `q = "山田"` → `['%山田%', '%山田%']` または `['%ヤマダ%', '%ヤマダ%']` など。  
  漢字とカナの両方に同じキーワードを渡すと「漢字またはふりがなのどちらかに一致」で検索できます。
- **role_flag = 1**: 利用者（生徒）のみ。スタッフ・管理者は検索結果から除外。
- **LIMIT**: 一覧爆発防止のため 50 件程度を推奨。

**LIKE のエスケープ**: キーワードに `%` や `_` が含まれる場合は、エスケープしてから `%keyword%` を組み立てる必要があります（後述のバリデーションで対応）。

**パラメータ例（Node.js）**:

```javascript
const q = (event.queryStringParameters?.q || '').trim();
if (!q) {
  return errorResponse('BAD_REQUEST', 'Query parameter "q" is required', 400);
}
const likePattern = '%' + q.replace(/[%_\\]/g, '\\$&') + '%';
const [rows] = await db.execute(
  'SELECT email AS user_id, name_kanji, name_kana, email FROM users WHERE role_flag = 1 AND (name_kanji LIKE ? OR name_kana LIKE ?) ORDER BY name_kana ASC LIMIT 50',
  [likePattern, likePattern]
);
```

MySQL の LIKE では `\` で `%` / `_` をエスケープする運用にすれば、通常のキーワードはそのまま部分一致になります。

---

## 2. 手動打刻実行 (POST /v1/attendance/manual)

### 2.1 バリデーション（event_id・生徒の実在チェック）

**推奨: 両方とも必ずチェックする。**

| チェック | 内容 | 失敗時 |
|----------|------|--------|
| **event_id** | `events` に存在するか | 404 Not Found |
| **email（生徒）** | `users` に存在し、かつ `role_flag = 1`（利用者）か | 404 または 400（「該当する生徒が存在しません」） |
| **申込** | （任意）そのイベントに申込済みか `registrations` で確認。未申込を許容するかは仕様次第。 | 許容しない場合は 400「当イベントに申込がありません」 |

- 実装の流れ:  
  1) path/body から `event_id` と `email`（または `user_id`）を取得。  
  2) `SELECT 1 FROM events WHERE event_id = ?` でイベント存在確認。  
  3) `SELECT email, role_flag FROM users WHERE email = ?` でユーザー存在確認し、`role_flag = 1` なら生徒として扱う。  
  4) （必要なら）`SELECT 1 FROM registrations WHERE event_id = ? AND email = ?` で申込有無を確認。

---

### 2.2 二重打刻防止の制御案

**前提**: 同一 (event_id, email) で既に `attendance_logs` にレコードがある場合の扱い。

| 案 | 内容 | メリット | デメリット |
|----|------|----------|------------|
| **A. エラーにする** | 既に 1 件以上あれば 409 Conflict または 400「既に打刻済みです」を返す。挿入しない。 | データが一意で分かりやすい。誤操作で重複しない。 | 打刻し直したい場合は「取り消し」などの別APIが必要。 |
| **B. 上書き（更新）** | 既存レコードの in_time（と out_time）を更新する。 | 打刻時刻の修正が 1 本の API でできる。 | 履歴が残らない。実装は「存在すれば UPDATE、なければ INSERT」になる。 |
| **C. 常に新規挿入（複数許可）** | 同一イベント・同一生徒で複数レコードを許す。 | 入退場を複数回記録する仕様なら自然。 | レポートで「1 イベント 1 人 1 打刻」としたい場合に集約が必要。 |

**推奨: 案 A（二重の場合はエラー）**

- 現状の「出席者一覧 CSV」などは「1 イベント 1 人 = 最新 1 件」で集約しているため、**1 イベント 1 人 1 打刻**を前提にすると運用が分かりやすい。
- 手動打刻は「QR を忘れた場合の補助」とし、既に打刻済みなら「既に打刻済みです」でエラーにし、必要なら別機能で「打刻取消・修正」を検討する形がよい。

**実装イメージ（案 A）**:

```text
1. 上記バリデーション（event_id・生徒の存在）を実施
2. SELECT 1 FROM attendance_logs WHERE event_id = ? AND email = ? LIMIT 1
   → 1 件以上あれば 409 または 400「既にこのイベントで打刻済みです」
3. 0 件なら INSERT（下記 2.3）
```

---

### 2.3 attendance_logs への挿入と「手動打刻」の記録

現行スキーマの `attendance_logs` には **is_manual も notes もありません**。

- **in_time**: 手動打刻実行時刻（サーバー現在時刻）でよい。
- **out_time**: NULL のまま（退室は別処理があれば後で更新）。
- **staff_email**: リクエストした管理者/スタッフの email（トークンから取得）。

**「手動打刻」を残す方法は次のいずれか。**

| 方法 | 内容 |
|------|------|
| **案α: マイグレーションで notes 追加** | `attendance_logs` に `notes VARCHAR(255) NULL` を追加し、手動のときだけ `notes = '手動打刻'` で INSERT。 |
| **案β: マイグレーションで is_manual 追加** | `attendance_logs` に `is_manual TINYINT(1) NOT NULL DEFAULT 0` を追加し、手動のときは `is_manual = 1` で INSERT。 |

**推奨: 案α（notes に「手動打刻」）**

- 既存カラムを変えず、1 カラム追加で済む。
- 将来「〇〇さんが手動で打刻」など文言を変えやすい。
- 集計・CSV で「手動打刻」かどうかを出しやすい。

**マイグレーション例**:

```sql
ALTER TABLE attendance_logs
ADD COLUMN notes VARCHAR(255) NULL COMMENT '備考（手動打刻時は「手動打刻」等）' AFTER staff_email;
```

**INSERT 例**:

```sql
INSERT INTO attendance_logs (email, event_id, in_time, staff_email, notes)
VALUES (?, ?, NOW(), ?, '手動打刻');
```

- 第1引数: 生徒の email  
- 第2引数: event_id  
- 第3引数: 実行者（管理者/スタッフ）の email  

---

## 3. 実装タスク一覧（案）

1. **マイグレーション**  
   - `attendance_logs` に `notes` を追加（上記 DDL）。

2. **GET /v1/students/search**  
   - ハンドラ: 例 `functions/students/search/index.ts`。  
   - 認証: トークン必須。`getUserRoleFlag` で role_flag を取得し、2 または 3 のみ許可。それ以外は 403。  
   - クエリ: `q` 必須。空なら 400。  
   - SQL: 上記 1.1 の形（LIKE のエスケープ込み）。  
   - レスポンス: `{ users: [ { user_id, name_kanji, name_kana, email } ] }`（user_id = email）。

3. **POST /v1/attendance/manual**  
   - ハンドラ: 例 `functions/attendance/manual/index.ts`。  
   - 認証: 管理者(3) または スタッフ(2) のみ。  
   - body: `{ event_id, email }`（または user_id = email で統一）。  
   - バリデーション: event 存在・生徒存在（role_flag=1）・二重打刻チェック。  
   - INSERT: `in_time = NOW()`, `staff_email = 実行者`, `notes = '手動打刻'`。  
   - 成功: 201 と作成された log_id など。

4. **ルーティング**  
   - local-server（および本番ルート）に  
     - `GET /v1/students/search`  
     - `POST /v1/attendance/manual`  
   を追加。

5. **結合テスト**  
   - 11.1.2（生徒検索・正常）、11.1.3（手動打刻・正常）、11.1.4（生徒検索/手動打刻・権限外で 403）を追加・実行。

---

## 4. 確認事項への回答まとめ

| 確認事項 | 回答 |
|----------|------|
| **SQL（漢字・ふりがな同時検索）** | `WHERE role_flag = 1 AND (name_kanji LIKE ? OR name_kana LIKE ?)` に `%q%` を 2 つバインド。キーワードの `%` / `_` はエスケープしてから渡す。 |
| **二重打刻防止** | **既にそのイベントで打刻済みならエラー（409/400）** とする案を推奨。上書きや複数挿入は要件に応じて検討。 |
| **バリデーション** | **event_id の実在**（events）と**生徒の実在・role_flag=1**（users）を必ずチェック。任意で registrations の申込有無をチェック。 |

以上を実装案とする。
