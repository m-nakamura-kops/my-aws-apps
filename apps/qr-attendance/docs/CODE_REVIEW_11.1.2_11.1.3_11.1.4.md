# コードレビュー: 11.1.2 / 11.1.3 / 11.1.4（手動打刻フロー）

忖度なしのガチレビューとリファクタリング案です。

---

## 1. セキュリティ（11.1.4 含む権限チェック）

### 現状

- 両エンドポイントとも「認証 → role 取得 → isStaffOrAdmin(roleFlag)」の**同じ 5 行**を手書きしている。
- 管理者専用は `checkAdminPermission(event)` で共通化されているが、**スタッフ以上**用の `checkStaffOrAdminPermission(event)` は存在しない。
- 権限チェックのロジック自体（`getUserRoleFlag` + `isStaffOrAdmin`）は妥当で、**認証なし → 401** / **認証ありだが権限不足 → 403** の切り分けはできている。

### 問題点

1. **重複**: 11.1.2 / 11.1.3 および participants など、スタッフ以上を要求するエンドポイントで同じブロックがコピペされている。
2. **一貫性**: 管理者専用は `checkAdminPermission` で統一されているのに、スタッフ以上は各ハンドラでばらばら。後任が「どれが正解？」となりやすい。
3. **auth.ts の設計**: `getUserEmailFromRequest` が **query / body の email も認める**ため、攻撃者が `?email=admin@example.com` を付けると、トークンがなくても別人になり得る。JWT を検証している場合はトークン優先なので影響は限定的だが、**認証必須エンドポイントでは「Authorization のみ」に絞る**オプションがあるとより安全。

### 改善案

**A. 共通 `checkStaffOrAdminPermission` を auth に追加し、両ハンドラで利用する**

```typescript
// shared/utils/auth.ts に追加
export async function checkStaffOrAdminPermission(event: APIGatewayProxyEvent): Promise<{
  authorized: boolean;
  email: string | null;
  error?: string;
}> {
  const email = getUserEmailFromRequest(event);
  if (!email) {
    return { authorized: false, email: null, error: 'Authentication required' };
  }
  const roleFlag = await getUserRoleFlag(email);
  if (!isStaffOrAdmin(roleFlag)) {
    return { authorized: false, email, error: 'Staff or Admin access required' };
  }
  return { authorized: true, email };
}
```

- 11.1.2 / 11.1.3 では「認証 → 権限」を 1 行で書ける。
- 他の「スタッフ以上」エンドポイント（participants 等）も順次これに寄せると、**一箇所で仕様変更**できる。

**B. （任意）認証必須エンドポイントでは Authorization のみ受け付ける**

- `getUserEmailFromRequest` に `allowQueryOrBody: boolean` を足し、スタッフ/管理者向けは `false` にして query/body の email を無視する、など。既存の「クエリで email を渡す」運用と衝突する場合は要検討。

---

## 2. 検索の効率（11.1.2）

### 現状

- `WHERE role_flag = 1 AND (name_kanji LIKE ? OR name_kana LIKE ?)` に `%q%` をバインド。
- `users` には `idx_role_flag` のみで、**name_kanji / name_kana にインデックスはない**。
- `LIMIT 50` で件数は抑えられている。

### 問題点

1. **LIKE '%...%'**: 先頭ワイルドカードのため、`role_flag` 以外のインデックスを効かせにくい。ユーザー数が 10 万件級になると **フルスキャン** に近い動きになり得る。
2. **キーワード長**: 1 文字の `q` で 50 件まで返すと、負荷と「ノイズの多さ」の両方で不利。
3. **エスケープ**: `escapeLike` で `%` / `_` / `\` をエスケープしており、SQL インジェクション的には問題ないが、**MySQL の LIKE ではバックスラッシュの扱い**（`sql_mode` の `NO_BACKSLASH_ESCAPES`）に依存する点はコメントがあると親切。

### 改善案

**A. 最低文字数の制限**

- `q.length < 2` のときは 400 にする、など。1 文字検索を禁止すると負荷とノイズを抑えられる。

**B. インデックスと将来の拡張**

- 現状の規模なら `LIMIT 50` と `role_flag = 1` で十分現実的。
- 将来ユーザーが増えた場合の選択肢として:
  - **FULLTEXT**: `name_kanji`, `name_kana` に FULLTEXT を張り、`MATCH ... AGAINST` で検索（日本語は n-gram 等の設定が必要）。
  - **検索用の正規化カラム**: ひらがなのみの `name_kana_normalized` を用意し、そこに B-tree インデックスを張って前方一致のみ許可する、など。

**C. ドキュメント**

- 「現状は role_flag + LIMIT で運用し、ユーザー数増加時は FULLTEXT や正規化カラムの検討を」と README や設計メモに 1 行書いておくと、後任が迷わない。

---

## 3. データの整合性（11.1.3 二重打刻・レースコンディション）

### 現状

```text
SELECT log_id FROM attendance_logs WHERE event_id = ? AND email = ? LIMIT 1
→ 0 件なら INSERT
```

- **チェックと挿入が別々**のため、**同時に同じ (event_id, email) で 2 リクエストが来ると、両方とも SELECT で 0 件 → 両方 INSERT** になり得る（レースコンディション）。

### 問題点

- 二重打刻防止が「アプリケーションの 1 回の SELECT」だけに依存しており、**DB レベルでの一意性が保証されていない**。

### 改善案（推奨順）

**A. UNIQUE 制約 + INSERT の 1 本化（推奨）**

- `attendance_logs` に `UNIQUE KEY (event_id, email)` を追加する（「1 イベント 1 人 1 打刻」が仕様なら）。
- 手動打刻は **INSERT のみ** にし、重複時は DB がエラーを返すので、それを捕捉して 409 に変換する。

```sql
-- マイグレーション例
ALTER TABLE attendance_logs
ADD UNIQUE KEY uk_event_email (event_id, email);
```

```typescript
try {
  const [result] = await db.execute(
    `INSERT INTO attendance_logs (email, event_id, in_time, staff_email, notes)
     VALUES (?, ?, NOW(), ?, '手動打刻')`,
    [email, eventId, staffEmail]
  );
  // ...
} catch (err: any) {
  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    return errorResponse('CONFLICT', 'Already checked in for this event', 409);
  }
  throw err;
}
```

- **SELECT は不要**になり、同時リクエストでも 2 件目は必ず UNIQUE 違反で失敗するため、レースに強い。

**B. SELECT をやめずに UNIQUE を追加する**

- 既存の「先に SELECT で 409 を返す」は UX 的に「既に打刻済み」と分かりやすいので残しつつ、**最後の砦**として UNIQUE を追加する。INSERT 時の重複エラーも 409 にマッピングする。

**C. トランザクション + SELECT FOR UPDATE**

- `BEGIN` → `SELECT ... FOR UPDATE` → 0 件なら INSERT → `COMMIT`。確実だが、パフォーマンスとデッドロックのリスクがあり、A より複雑。UNIQUE で足りるなら A で十分。

---

## 4. コードの可読性・堅牢性

### 現状の良い点

- 役割ごとにハンドラが分かれており、流れは追いやすい。
- LIKE のエスケープを関数に分けている。
- エラーメッセージは英語で統一されている。

### 問題点・改善案

**A. マジックナンバー（role_flag）**

- `role_flag === 1` が「生徒」であることが、ハンドラだけ見ても分からない。
- **改善**: `role-check.ts` の `UserRole` を利用する。

```typescript
import { UserRole, isStaffOrAdmin } from '../../../shared/utils/role-check';
// ...
if (users[0].role_flag !== UserRole.USER) {
  return errorResponse('BAD_REQUEST', 'Target user must be a student (role_flag=1)', 400);
}
```

**B. event_id の型・バリデーション**

- `event_id` をそのまま SQL に渡している。数値想定なら **数値化と範囲チェック** があると安全。

```typescript
const eventIdNum = parseInt(String(eventId), 10);
if (isNaN(eventIdNum) || eventIdNum < 1) {
  return errorResponse('BAD_REQUEST', 'Invalid event_id', 400);
}
// 以降 eventIdNum を使用するか、eventId をサニタイズした値に統一
```

**C. JSON.parse の例外**

- `JSON.parse(event.body)` に失敗すると 500 になり、スタックトレースがログに出る可能性がある。
- **改善**: try/catch で囲み、400 を返す。

```typescript
let body: { event_id?: number; eventId?: number; email?: string; user_id?: string };
try {
  body = JSON.parse(event.body);
} catch {
  return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400);
}
```

**D. 定数・メッセージの一元化**

- `'手動打刻'` や `'Staff or Admin access required'` をハンドラ内に直書きしている。複数箇所で使うなら **定数や shared のメッセージ** にまとめると、仕様変更時に修正が 1 箇所で済む。

**E. レスポンス型**

- `(rows || []).map((r: any) => ...)` の `any` をやめ、**返却型を interface で定義**すると、後任が「何が返るか」をすぐ把握できる。

---

## 5. リファクタリング案まとめ（優先度順）

| 優先度 | 項目 | 内容 |
|--------|------|------|
| 高 | 二重打刻のレース耐性 | `attendance_logs` に UNIQUE(event_id, email) を追加し、INSERT 重複時は 409 にマッピング。SELECT チェックは残してもよい。 |
| 高 | 権限チェックの共通化 | `checkStaffOrAdminPermission(event)` を auth に追加し、11.1.2 / 11.1.3 で利用。 |
| 中 | POST body のパース | JSON.parse を try/catch で囲み、失敗時は 400。 |
| 中 | event_id のバリデーション | 数値化と isNaN/範囲チェックを追加。 |
| 中 | role_flag のマジックナンバー排除 | `UserRole.USER` 等を使う。 |
| 低 | 検索の最低文字数 | `q.length < 2` で 400 にする等。 |
| 低 | 返却型の型定義 | `interface StudentSearchResult` 等を定義。 |

---

## 6. 結論

- **セキュリティ**: 権限ロジックは妥当だが、スタッフ以上用の共通関数がなく、他エンドポイントとパターンが揃っていない。`checkStaffOrAdminPermission` の導入を推奨。
- **検索効率**: 現状規模では LIMIT と role_flag で許容範囲。将来は FULLTEXT や正規化カラムを検討し、最低文字数制限があるとよい。
- **二重打刻**: 現状はレースに弱い。**UNIQUE 制約 + INSERT 時の重複エラー → 409** にすると堅牢になる。
- **可読性**: マジックナンバー削減・JSON と event_id のバリデーション・返却型の明示で、後任が「何をしているコードか」を把握しやすくなる。

上記を反映すれば、「プロのエンジニアの視点でガチのレビュー」として十分通る水準になる。
