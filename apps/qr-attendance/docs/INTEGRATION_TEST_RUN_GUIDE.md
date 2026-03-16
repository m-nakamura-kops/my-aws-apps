# 結合テストの実行手順（最初から）

結合テストを実行するための手順を、MySQL の再起動方法も含めてまとめています。

---

## 前提

- リポジトリのパス: `MySelector`（または `apps/qr-attendance/backend` が存在する場所）
- バックエンドの DB 設定: `apps/qr-attendance/backend/.env` に `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` を記載済みであること
- **手動打刻（11.1.3）を通す場合**: `attendance_logs` に `notes` カラムを追加するマイグレーションを実行しておくこと。  
  `mysql -u root -p qr_attendance < apps/qr-attendance/database/migrations/002_add_attendance_logs_notes.sql`

---

## 手順 1: MySQL を再起動する（接続数エラー対策）

「Too many connections」が出たときは、MySQL を再起動して接続を一度リセットします。

### 1-1. MySQL の入れ方でコマンドが違います

**Homebrew で入れている場合（よくあるパターン）:**

```bash
brew services restart mysql
```

別名で入っている場合:

```bash
brew services restart mysql@8.0
# または
brew services restart mariadb
```

**Mac の「システム環境設定」や「MySQL のアプリ」から起動している場合:**

- メニューバーの MySQL アイコン → Stop MySQL → Start MySQL  
  または  
- システム環境設定 → MySQL → Stop → Start

**コマンドで直接起動している場合（例: mysql.server）:**

```bash
# 停止
sudo /usr/local/mysql/support-files/mysql.server stop
# 起動
sudo /usr/local/mysql/support-files/mysql.server start
```

**どの方法で入れたか分からない場合:**

- `brew services list` で `mysql` や `mariadb` が出れば Homebrew
- 出なければ上記の「システム環境設定」や `mysql.server` を確認

### 1-2. 再起動できたか確認

```bash
mysql -u root -p -e "SELECT 1;"
# パスワードを聞かれたら入力。 "1" が表示されれば OK
```

---

## 手順 2: API サーバーを止める

結合テスト用のシードを流すときは、**API を止めた状態**にします。

- **`npm run dev` を実行しているターミナル**を開く
- そのターミナルで **Ctrl + C** を押して API を終了する
- プロンプトが戻れば停止できています

（これから API を起動するだけの状態なら、この手順は飛ばしてよいです。）

---

## 手順 3: テスト用ユーザーを DB に投入する（シード）

**backend ディレクトリ**で、シードスクリプトを 1 回だけ実行します。

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
node scripts/seed-test-users.js
```

**成功すると、次のようなメッセージが出ます:**

```
更新: it-admin@example.com (管理者)
更新: it-staff@example.com (スタッフ)
...
--- 結合テスト用 ログイン情報（共通パスワード: TestPass12）---
  管理者: it-admin@example.com
  スタッフ: it-staff@example.com
  利用者: it-user@example.com
  ...
```

**「Too many connections」が出た場合:**

1. 手順 2 を再度確認し、**API が本当に止まっているか**確認する  
2. 手順 1 の **MySQL の再起動**をもう一度行う  
3. その後、もう一度 `node scripts/seed-test-users.js` を実行する  

---

## 手順 4: API サーバーを起動する

**別のターミナル**（または手順 2 で止めたターミナル）で:

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev
```

「Local API Server running on http://localhost:3001」のような表示が出れば起動できています。**このターミナルは閉じずにそのままにしておく**か、バックグラウンドで動かしたままにします。

---

## 手順 5: 結合テストを実行する

**もう一つのターミナル**で、backend に移動してから結合テストを実行します。  
シードは手順 3 で済ませているので、**シードをスキップ**して実行します。

```bash
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
SKIP_SEED=1 npm run integration-test
```

**成功時は次のように表示されます:**

```
OK 1.1.1 1.1.1 認証 ログイン（成功）
OK 1.1.2 ...
...
=== サマリ ===
OK: 39 NG: 0 SKIP: 12
```

（NG が 0 に近いほど問題なしです。）

---

## よくある失敗と対処

| 状況 | 対処 |
|------|------|
| シードで「Too many connections」 | API を止める（手順 2）→ MySQL 再起動（手順 1）→ もう一度シード（手順 3） |
| ログインで 500 | シードが 1 回も成功していない可能性。手順 2 → 3 をやり直し、成功ログを確認してから手順 4 → 5 |
| `npm run dev` で「package.json がない」 | リポジトリ直下ではなく、`cd apps/qr-attendance/backend` してから実行する |
| 結合テストで「ENOENT」「scripts/... がない」 | 必ず `cd apps/qr-attendance/backend` してから `SKIP_SEED=1 npm run integration-test` を実行する |

---

## 手順の一覧（コピペ用）

```bash
# 1) MySQL 再起動（Homebrew の例）
brew services restart mysql

# 2) リポジトリの backend へ移動
cd /Users/masahiro/MySelector/apps/qr-attendance/backend

# 3) ※この時点で npm run dev は止めておく
# シード実行（テストユーザー投入）
node scripts/seed-test-users.js

# 4) 別ターミナルで API 起動
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
npm run dev

# 5) さらに別ターミナルで結合テスト
cd /Users/masahiro/MySelector/apps/qr-attendance/backend
SKIP_SEED=1 npm run integration-test
```

以上です。
