# バックエンド単体テスト レポート

## 1. 対象範囲

- **カバレッジ対象**: `shared/` 配下の TypeScript（`shared/utils`, `shared/db`）
- **handlers**: `functions/**/index.ts` は Lambda エントリのため、現行 Jest のカバレッジ対象外。必要に応じて統合テストで対応。

---

## 2. ファイル別 分析（未テスト項目）

### 2.1 shared/utils

| ファイル | 役割 | テスト状況 | 未テスト項目 |
|----------|------|------------|--------------|
| `validation.ts` | メール・パスワード・必須文字列の検証 | ✅ あり | なし |
| `csv.ts` | CSV 1行パース・ヘッダー判定 | ✅ あり | なし（line 15 のみ未カバー） |
| `role-check.ts` | 役割フラグの判定・表示名 | ✅ あり | なし |
| `response.ts` | Lambda レスポンス生成 | ✅ あり | なし |
| `auth.ts` | リクエストから email/role 取得・管理者チェック | ✅ あり | なし |

### 2.2 shared/db

| ファイル | 役割 | テスト状況 | 未テスト項目 |
|----------|------|------------|--------------|
| `connection.ts` | DB プール初期化・設定取得・取得・クローズ | ✅ あり | なし |
| `secrets.ts` | Secrets Manager から認証情報取得・DB 初期化 | ✅ あり | なし（line 20 の分岐のみ未カバー） |

### 2.3 handlers（参考）

- `functions/admin/**/index.ts`, `functions/users/**/index.ts`, `functions/events/**/index.ts` など
- 現行の `collectCoverageFrom` に含まれておらず、単体テストは未実施。E2E/統合テストでカバーする想定。

---

## 3. 優先度と実施順

1. **高**: `response.ts` — 依存なし・純粋関数。即時カバレッジ向上。
2. **高**: `auth.ts` — 多くの API で使用。Jest 用 tsconfig 修正のうえ、getDB とイベントをモックしてテスト。
3. **高**: `connection.ts` — getDBConfig は純粋、initDB/getDB/closeDB は mysql2 をモック。
4. **高**: `secrets.ts` — 環境変数・AWS SDK をモックして分岐をテスト。

---

## 4. テスト仕様・ログ・カバレッジ（実施ごとに更新）

### 4.1 実施前（ベースライン）

- **テストスイート**: 3（validation, csv, role-check）
- **テスト数**: 25
- **カバレッジ**: 約 47% Stmts（auth は収集失敗のため未計上）

### 4.2 response.test.ts 追加後

**テスト仕様**

- `successResponse(data, statusCode?)`: デフォルト 200、JSON ボディ、CORS ヘッダー。任意で statusCode 指定。
- `errorResponse(error, message, statusCode?, details?)`: デフォルト 400、error/message（と任意 details）の JSON、CORS ヘッダー。
- `corsResponse()`: 200、空ボディ、CORS ヘッダー。

**実行ログ（抜粋）**

```
PASS shared/utils/__tests__/response.test.ts
  response
    successResponse
      ✓ returns 200 and JSON body by default
      ✓ accepts custom status code
      ✓ includes CORS headers
    errorResponse
      ✓ returns default 400 and error shape
      ✓ accepts custom status code and details
      ✓ includes CORS headers
    corsResponse
      ✓ returns 200 with empty body and CORS headers
```

**カバレッジ**

- 全体: 約 38.8% Stmts（db/auth 未テストのため）
- `response.ts`: **100%** Stmts/Branch/Funcs/Lines

---

### 4.3 auth.test.ts 追加後

**テスト仕様**

- `getUserEmailFromRequest(event)`: Bearer JWT（2番目セグメント）・Bearer base64 JSON・queryStringParameters・body から email 取得。優先順位・null・パース失敗のフォールバックを検証。
- `getUserRoleFlag(email)`: getDB をモックし、存在時は role_flag 返却、不在時・role_flag 欠損時は null。
- `checkAdminPermission(event)`: email なし時エラー、管理者でない時エラー、管理者の時 authorized: true。

**実行ログ（抜粋）**

```
PASS shared/utils/__tests__/auth.test.ts
  auth
    getUserEmailFromRequest … 9 tests
    getUserRoleFlag … 3 tests
    checkAdminPermission … 3 tests
```

**カバレッジ**

- `auth.ts`: **100%** Stmts/Branch/Funcs/Lines

---

### 4.4 connection.test.ts 追加後

**テスト仕様**

- `getDBConfig()`: 環境変数未設定時デフォルト値、設定時は process.env から読み取り。
- `initDB(config)`: mysql2 createPool をモックし、渡した config で呼ばれること・2回目は同一プールを返すこと・ssl: true で ssl オプションが渡ることを検証。
- `getDB()`: プール未初期化時に initDB(getDBConfig()) が呼ばれること。
- `closeDB()`: pool.end() が呼ばれ、次回 getDB() で再初期化されること。

**実行ログ（抜粋）**

```
PASS shared/db/__tests__/connection.test.ts
  db/connection
    getDBConfig … 2 tests
    initDB … 3 tests
    getDB … 1 test
    closeDB … 1 test
```

**カバレッジ**

- `connection.ts`: **100%** Stmts/Branch/Funcs/Lines

---

### 4.5 secrets.test.ts 追加後

**テスト仕様**

- `initDBFromSecrets()`: DB_SECRET_ARN 未設定時は getDBConfig/initDB でローカル初期化。DB_SECRET_ARN 設定時は Secrets Manager の send をモックし、SecretString をパースして initDB に渡すこと。DB_SSL=true で ssl: true が渡ること。SecretString 空で throw。send 失敗で再 throw。

**実行ログ（抜粋）**

```
PASS shared/db/__tests__/secrets.test.ts
  db/secrets
    initDBFromSecrets … 5 tests
```

**カバレッジ**

- `secrets.ts`: **96.29%** Stmts、81.81% Branch（line 20 の一部分岐未カバー）

---

### 4.6 最終結果（全体カバレッジ 80% 以上達成）

| 指標 | 結果 |
|------|------|
| テストスイート数 | 7 |
| テスト数 | 59 |
| **% Stmts** | **98.5%** |
| % Branch | 95.58% |
| % Funcs | 100% |
| % Lines | 99.21% |

**ファイル別（最終）**

| File | % Stmts | % Branch | % Funcs | % Lines |
|------|---------|----------|--------|---------|
| All files | 98.5 | 95.58 | 100 | 99.21 |
| db/connection.ts | 100 | 100 | 100 | 100 |
| db/secrets.ts | 96.29 | 81.81 | 100 | 96.29 |
| utils/auth.ts | 100 | 100 | 100 | 100 |
| utils/csv.ts | 95.83 | 91.66 | 100 | 100 |
| utils/response.ts | 100 | 100 | 100 | 100 |
| utils/role-check.ts | 100 | 100 | 100 | 100 |
| utils/validation.ts | 100 | 100 | 100 | 100 |

---

## 5. 更新履歴

- 初版: 分析と未テスト項目リストを作成。
- response.test.ts 追加。test_report に 4.2 追記。
- Jest 用 tsconfig.jest.json 追加、auth のカバレッジ収集を修正。
- auth.test.ts 追加。test_report に 4.3 追記。
- connection.test.ts / secrets.test.ts 追加。test_report に 4.4・4.5・4.6 追記。全体カバレッジ 80% 以上達成。
