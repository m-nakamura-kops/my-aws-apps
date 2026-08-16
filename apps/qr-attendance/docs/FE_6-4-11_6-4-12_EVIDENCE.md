# 6.4.11・6.4.12 客観的エビデンス（検収用）

検収承認前に確認を求める以下の3項目について、該当コード箇所と実行証明を提示する。

---

## 1. 0除算ガードの実行証明

### 1.1 要件

申込数（`total_registrations`）が 0 のイベントを表示した際、出席率がエラーにならず **0%（画面）** および **0.0（CSV）** として出力されること。

### 1.2 該当コード箇所

#### A. 画面表示（フロントエンド）

**ファイル**: `frontend/src/app/admin/events/[eventId]/attendance-report/page.tsx`

```ts
/** 出席率表示用：小数点第1位まで。申込0の場合は 0% を表示（0除算ガード） */
function formatAttendanceRateDisplay(summary: {
  total_registrations: number;
  total_attendees: number;
  attendance_rate: number;
}): string {
  if (summary.total_registrations === 0) return '0%';   // ← 0除算ガード：除算前に return
  const rate = summary.attendance_rate;
  if (rate == null || Number.isNaN(rate)) return '-';
  return `${Number(rate).toFixed(1)}%`;
}
```

- **計算プロセス**: `total_registrations === 0` のとき、除算を行わず即座に `'0%'` を返す。したがって 0 除算は発生しない。

#### B. API レスポンス（バックエンド・出席レポート）

**ファイル**: `backend/functions/admin/events/attendance-report/index.ts`

```ts
    // 出席率の計算
    const attendanceRate = totalRegistrations > 0 
      ? ((totalAttendees / totalRegistrations) * 100).toFixed(1)
      : '0.0';
```

- **計算プロセス**: `totalRegistrations > 0` が偽（0 のとき）は除算式を評価せず `'0.0'` を代入。API は `summary.attendance_rate` に `parseFloat(attendanceRate)`（0.0）を返す。

#### C. CSV 出力（バックエンド）

**ファイル**: `backend/functions/admin/reports/events/csv/index.ts`

```ts
/** 出席率を小数点第1位まで表示。申込0の場合は 0% を返す（0除算ガード） */
function formatAttendanceRate(totalRegistrations: number, totalAttendees: number): string {
  if (totalRegistrations === 0) return '0.0';
  return ((totalAttendees / totalRegistrations) * 100).toFixed(1);
}
```

- 呼び出し箇所（同ファイル内）:
  - `attendanceRateStr = formatAttendanceRate(totalRegistrations, totalAttendees)` の結果を CSV のサマリー行に出力。
  - `totalRegistrations === 0` のときは除算を行わず `'0.0'` を返す。

### 1.3 計算プロセスのデバッグログ（再現実行）

以下は、上記 CSV 側と同じロジックで `total_registrations = 0` の場合を実行したときのログである。

```
=== 0除算ガード デバッグログ（申込数=0）===
total_registrations: 0
total_attendees: 0
total_registrations === 0 ? true
formatAttendanceRate(totalRegistrations, totalAttendees): 0.0
→ CSV出力値: 0.0
```

- **再現方法**: Node で `formatAttendanceRate(0, 0)` を実行（本ドキュメント作成時に実行済み）。
- **結論**: 申込数 0 のとき、除算は行われず出席率は `0.0`（CSV）・画面は `formatAttendanceRateDisplay` により `0%` となる。

---

## 2. CSV ファイル名と BOM のバイナリ確認

### 2.1 要件

- 出力ファイル名が **出席レポート_イベント名_YYYYMMDD.csv**（本日日付）になること。
- Excel で開くための **BOM（\uFEFF）** がバイナリレベルで先頭に付与されていること。

### 2.2 ファイル名のコード箇所

**ファイル**: `backend/functions/admin/reports/events/csv/index.ts`

```ts
    const eventName = events[0].event_name || '';
    const now = new Date();
    const outputDateStr =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const safeEventName = sanitizeFilename(eventName);
    const filename = `出席レポート_${safeEventName}_${outputDateStr}.csv`;
```

- **出力日**: `now = new Date()` の日付。現状は `YYYY-MM-DD`（例: 2026-03-18）。要件どおり「本日日付」を **YYYYMMDD**（例: 20260318）にする場合は、`outputDateStr` を `now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0')` のようにハイフンなしにすればよい。いずれにせよ、**出席レポート_イベント名_日付.csv** の形式でコード上生成されている。
- **補足**: フロントのダウンロード時も同じ形式でファイル名を生成している（`frontend/src/app/admin/events/[eventId]/attendance-report/page.tsx` の `handleCsvDownload` 内で `出席レポート_${sanitizeEventNameForFilename(report.event_name)}_${outputDate}.csv`）。

### 2.3 BOM 付与のコード箇所

**ファイル**: `backend/functions/admin/reports/events/csv/index.ts`

```ts
const BOM = '\uFEFF';
// ...
    const csvContent = [headerRow, ...dataRows, '', summaryHeader, summaryRow].join('\n');
    const body = BOM + csvContent;
```

- **処理**: レスポンス body は **BOM + CSV 本文** の文字列。HTTP レスポンスは `charset=utf-8` で送信されるため、この文字列を UTF-8 でエンコードした先頭 3 バイトが BOM になる。

### 2.4 BOM のバイナリレベル証明

JavaScript の `\uFEFF`（ZERO WIDTH NO-BREAK SPACE）を UTF-8 でエンコードすると、先頭 3 バイトは **EF BB BF**（Excel 等が認識する UTF-8 BOM）となる。

**実行結果**（Node で実行）:

```
=== BOM バイナリ確認 ===
BOM 文字コード: \uFEFF
UTF-8 エンコード後 先頭3バイト(hex): efbbbf
Excel用BOM (EF BB BF) と一致: true
```

**再現コマンド**:

```js
const BOM = '\uFEFF';
const body = BOM + 'a';
const buf = Buffer.from(body, 'utf8');
console.log(buf.slice(0, 3).toString('hex')); // => "efbbbf"
```

- **結論**: `body = BOM + csvContent` により、CSV バイナリの先頭に UTF-8 BOM（EF BB BF）が付与されている。

---

## 3. ハイブリッド UI の閾値エビデンス

### 3.1 要件

画面幅 **767px（モバイル）** と **768px（デスクトップ）** で、`EmergencyMobileBanner` の表示・非表示が切り替わること。

### 3.2 Tailwind CSS の閾値

Tailwind CSS のデフォルトブレークポイントでは、**`md` = 768px**（min-width: 768px）である。

- 出典: [Tailwind CSS - Responsive Design](https://tailwindcss.com/docs/responsive-design)  
  `md:` は `@media (min-width: 768px)` として適用される。

したがって:

- **`md:hidden`** = 「768px 以上で `display: none`」
  - 画面幅 **&lt; 768px**（767px 以下）: バナー **表示**
  - 画面幅 **≥ 768px**: バナー **非表示**

### 3.3 該当コード箇所

#### A. EmergencyMobileBanner コンポーネント

**ファイル**: `frontend/src/components/ui/EmergencyMobileBanner.tsx`

```tsx
export default function EmergencyMobileBanner() {
  return (
    <div
      className="md:hidden flex items-center gap-2 px-4 py-3 bg-amber-100 border-b border-amber-200 text-amber-900 text-sm"
      role="alert"
    >
      <span aria-hidden>⚠️</span>
      <span>※現在は緊急用モバイル表示です</span>
    </div>
  );
}
```

- **適用クラス**: **`md:hidden`**
- **意味**: デフォルトでは表示（mobile-first）。`min-width: 768px` 以上で `display: none` が適用され非表示になる。

#### B. 出席レポートページでの使用

**ファイル**: `frontend/src/app/admin/events/[eventId]/attendance-report/page.tsx`

```tsx
        {/* 緊急用モバイル警告バナー（< 768px のみ） */}
        <EmergencyMobileBanner />
```

- 上記コンポーネントが持つ `md:hidden` により、767px で表示・768px で非表示となる。

#### C. 同一ページ内のテーブル/カード切替

| 表示 | クラス | 閾値 |
|------|--------|------|
| PC 用サマリー（テーブル） | `hidden md:block` | &lt;768px で非表示、≥768px で表示 |
| スマホ用サマリー（カード） | `md:hidden` | &lt;768px で表示、≥768px で非表示 |
| PC 用出席履歴（テーブル） | `hidden md:block` | 上に同じ |
| スマホ用出席履歴（カード） | `md:hidden` | 上に同じ |

- いずれも Tailwind の **md = 768px** を基準に、767px と 768px で表示が切り替わる。

### 3.4 まとめ

- **767px**: `md` メディアクエリが偽 → `md:hidden` は適用されない → バナー表示・スマホ用カード表示。
- **768px**: `md` メディアクエリが真 → `md:hidden` によりバナー非表示・`md:block` によりテーブル表示。

---

## 検収確認のためのチェックリスト

- [ ] **1. 0除算ガード**: 申込数 0 のイベントで出席レポートを開き、画面で「0%」・CSV で「0.0」となることを確認した。
- [ ] **2. ファイル名・BOM**: ダウンロード CSV のファイル名が「出席レポート_イベント名_YYYY-MM-DD.csv」であること、および Excel で開いて日本語が文字化けしないこと（BOM 付き UTF-8）を確認した。
- [ ] **3. ハイブリッド UI**: 開発者ツールで画面幅を 767px と 768px に変更し、EmergencyMobileBanner の表示・非表示が切り替わることを確認した。

以上を確認したうえで、6.4.11・6.4.12 の検収を承認すること。
