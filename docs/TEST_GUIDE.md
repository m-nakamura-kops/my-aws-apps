# 検収環境整備ガイド（TEST_GUIDE）

QRコード出欠アプリ（qr-attendance）の検収・動作確認を行うための環境整備手順です。  
**6.4.8〜6.4.10 の実装完了確認**は、本ガイドに沿って環境を整え、手順を実行したうえで行ってください。

---

## 1. ディレクトリ構成図

プロジェクト全体の階層構造を以下に示します。  
（絶対パスはリポジトリルートを `/Users/masahiro/MySelector` とした場合の例です。環境に合わせて読み替えてください。）

```
MySelector/                          # リポジトリルート
├── docs/                            # プロジェクト全体のドキュメント
│   ├── TEST_GUIDE.md                # 本ガイド
│   └── SECRETS_PUSH_FIX.md
├── apps/
│   ├── qr-attendance/               # QR出欠アプリ（検収対象）
│   │   ├── frontend/                # Next.js フロントエンド（ポート 3000）
│   │   │   ├── src/
│   │   │   ├── public/
│   │   │   ├── package.json
│   │   │   ├── .env.local           # 要設定: NEXT_PUBLIC_API_URL 等
│   │   │   └── next.config.js
│   │   ├── backend/                 # Node/API バックエンド（ポート 3001）
│   │   │   ├── functions/           # Lambda 相当の API ハンドラ
│   │   │   │   ├── admin/           # 管理系（events, staffs, students 等）
│   │   │   │   ├── users/           # ユーザー・打刻・登録等
│   │   │   │   └── ...
│   │   │   ├── shared/
│   │   │   ├── local-server.ts      # ローカル API サーバー
│   │   │   ├── package.json
│   │   │   └── .env                 # 要設定: DB 等
│   │   ├── docs/                    # qr-attendance 用ドキュメント
│   │   ├── database/
│   │   ├── infrastructure/
│   │   ├── START_FRONTEND.sh
│   │   └── START_BACKEND.sh
│   ├── task-management/
│   ├── tetris/
│   └── notion-integration/
└── ...
```

**検収で主に触るディレクトリ**

| パス | 説明 |
|------|------|
| `apps/qr-attendance/frontend` | フロントエンド（Next.js）。`npm run dev` で起動し、既定で **ポート 3000**。 |
| `apps/qr-attendance/backend` | バックエンド API。`npm run dev` で local-server が起動し、既定で **ポート 3001**。 |
| `apps/qr-attendance/docs` | 機能仕様・デバイスマトリクス・エビデンス等のドキュメント。 |

---

## 2. コマンド実行手順（絶対パス指定）

以下の手順は、**どのディレクトリでどのコマンドを実行するか**を絶対パスで示したものです。  
リポジトリルートを `ROOT=/Users/masahiro/MySelector` とします（ご自身の環境では適宜置き換えてください）。

1. **ターミナルを開き、リポジトリルートに移動する**
   ```bash
   cd /Users/masahiro/MySelector
   ```

2. **フロントエンドの依存関係をインストールする**
   ```bash
   cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
   npm install
   ```

3. **フロントエンドの環境変数ファイルを用意する**
   - 存在しない場合は `.env.example` をコピーして `.env.local` を作成する。
   ```bash
   cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
   cp .env.example .env.local
   ```
   - `.env.local` で `NEXT_PUBLIC_API_URL=http://localhost:3001` が設定されていることを確認する。

4. **バックエンドの依存関係をインストールする**
   ```bash
   cd /Users/masahiro/MySelector/apps/qr-attendance/backend
   npm install
   ```

5. **バックエンドの環境変数ファイルを用意する**
   - 存在しない場合は `.env.example` をコピーして `.env` を作成し、DB 接続情報等を設定する。
   ```bash
   cd /Users/masahiro/MySelector/apps/qr-attendance/backend
   cp .env.example .env
   ```

6. **バックエンドのビルドを行う（Lambda 関数の JS を生成するため）**
   ```bash
   cd /Users/masahiro/MySelector/apps/qr-attendance/backend
   npm run build
   ```

7. **バックエンドのローカル API サーバーを起動する**
   ```bash
   cd /Users/masahiro/MySelector/apps/qr-attendance/backend
   npm run dev
   ```
   - 起動後、**http://localhost:3001** で API が待ち受けることを確認する。  
   - このターミナルはそのまま開いた状態にする。

8. **別のターミナルを開き、フロントエンドの開発サーバーを起動する**
   ```bash
   cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
   npm run dev
   ```

9. **ブラウザでフロントエンドにアクセスする**
   - **http://localhost:3000** を開き、ログイン・イベント一覧・出席確認（6.4.8〜6.4.10）等の動作を確認する。

10. **検収後、サーバーを停止する**
    - フロントエンド・バックエンドのそれぞれのターミナルで `Ctrl+C` を押してプロセスを終了する。

---

## 3. トラブルシューティング

### 3.1 `npm install` が必要な場合

- **症状**: `npm run dev` や `npm run build` で「モジュールが見つからない」などのエラーが出る。
- **対処**:
  1. 対象のパッケージが存在するディレクトリで `npm install` を実行する。
  2. **フロントエンド**の場合:
     ```bash
     cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
     npm install
     ```
  3. **バックエンド**の場合:
     ```bash
     cd /Users/masahiro/MySelector/apps/qr-attendance/backend
     npm install
     ```
  4. 依存関係をクリーンにし直す場合（任意）:
     ```bash
     rm -rf node_modules package-lock.json
     npm install
     ```
     実行するディレクトリは、上記の `frontend` または `backend` のどちらかとする。

### 3.2 ポート 3000 が既に使用されている場合

- **症状**: フロントエンドで `npm run dev` を実行すると「Port 3000 is already in use」などと表示される。
- **原因**: Next.js の開発サーバーは既定でポート 3000 を使用する。別のプロセス（他の Next アプリやサービス）が既に 3000 を使用していると競合する。
- **対処（いずれか）**:

  **A. 既存プロセスを止める（推奨）**
  - ポート 3000 を使っているプロセスを特定して終了する。
  - macOS の例:
    ```bash
    lsof -i :3000
    ```
    表示された PID を確認し、終了する:
    ```bash
    kill <PID>
    ```
  - 再度フロントエンドを起動する:
    ```bash
    cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
    npm run dev
    ```

  **B. 別ポートで起動する**
  - 環境変数でポートを変更して起動する（例: 3002）:
    ```bash
    cd /Users/masahiro/MySelector/apps/qr-attendance/frontend
    PORT=3002 npm run dev
    ```
  - ブラウザでは **http://localhost:3002** でアクセスする。  
  - フロントの `.env.local` で `NEXT_PUBLIC_API_URL` を変更する必要はない（API は 3001 のまま）。

### 3.3 ポート 3001 が既に使用されている場合

- バックエンドのローカルサーバーは既定でポート 3001 を使用する。競合する場合は:
  - `lsof -i :3001` でプロセスを確認し、`kill <PID>` で終了する。
  - またはバックエンド起動時に別ポートを指定する:
    ```bash
    cd /Users/masahiro/MySelector/apps/qr-attendance/backend
    PORT=3003 npm run dev
    ```
    その場合、フロントの `.env.local` の `NEXT_PUBLIC_API_URL` を `http://localhost:3003` に合わせて変更する。

---

## 4. 6.4.8〜6.4.10 の実装完了確認について

- 上記 **「2. コマンド実行手順」** に従って環境を整え、フロント・バックを起動できること。
- **「3. トラブルシューティング」** を参照し、必要に応じて `npm install` やポート競合を解消できること。
- ブラウザで http://localhost:3000 にアクセスし、以下が確認できることをもって **実装完了** とみなす。
  - **6.4.8** 出席確認（参加者一覧）: in_time/out_time 表示、カード＋検索・未打刻フィルタ、タップ領域 44px 対応。
  - **6.4.9** イベント管理一覧: ホーム `/home`、削除確認にイベント名表示、成功トースト、バリデーション、操作列のタップ領域対応。
  - **6.4.10** イベント編集: 新規/編集モーダルにおける定員・開催日時・イベント名のバリデーション。

詳細な仕様・デバイス方針は `apps/qr-attendance/docs/` 内の各ドキュメントを参照してください。

---

## 5. 動作確認結果（6.4.11・6.4.12）

本ガイド「2. コマンド実行手順」に従い環境を整え、管理者でログインした状態で以下を確認した結果を記録する。

### 5.1 確認環境

- **手順 1〜7**: リポジトリルート移動、フロント/バックの `npm install`・`.env` 準備、バックエンド `npm run build`・`npm run dev`（ポート 3001）。
- **手順 8〜9**: 別ターミナルでフロント `npm run dev`（ポート 3000）、ブラウザで http://localhost:3000 にアクセス。

### 5.2 No. 6.4.11（管理者：出席レポート表示）確認項目

| # | 確認項目 | 期待結果 | 結果（実施時に○/×を記入） |
|---|----------|----------|----------------------------|
| 1 | 管理者でログインし、イベント一覧から「レポート」をクリック | `/admin/events/[eventId]/attendance-report` に遷移し、出席レポートが表示される | |
| 2 | サマリー表示 | 申込数・出席数・欠席数・出席率が表示され、**出席率は小数点第1位**（例: 92.3%）で表示される | |
| 3 | 申込者が0人のイベントでレポートを表示 | エラーにならず、出席率は **0%** と表示される（0除算ガード） | |
| 4 | PC表示（画面幅 ≥768px） | サマリーが**一覧表（テーブル）**、出席履歴が**テーブル**で表示される | |
| 5 | スマホ表示（画面幅 <768px） | **「※現在は緊急用モバイル表示です」** バナーが表示され、サマリー・出席履歴が**カード形式**で表示される | |

### 5.3 No. 6.4.12（管理者：レポートCSV出力）確認項目

| # | 確認項目 | 期待結果 | 結果（実施時に○/×を記入） |
|---|----------|----------|----------------------------|
| 1 | 出席レポート画面で「CSVをダウンロード」ボタンをクリック | CSV がダウンロードされ、ファイル名が **出席レポート_イベント名_出力日.csv** 形式（出力日は YYYY-MM-DD）である | |
| 2 | ダウンロードした CSV を Excel 等で開く | 日本語が文字化けせず表示される（**BOM 付き UTF-8**） | |
| 3 | CSV 末尾のサマリー行 | 「申込数,出席数,欠席数,出席率（%）」のヘッダーとデータ行があり、**出席率は小数点第1位**（申込0の場合は 0.0）である | |

### 5.4 結果サマリー（実装完了報告時）

- 上記 5.2・5.3 の全項目を、TEST_GUIDE の手順 1〜10 に沿った環境で実施し、結果を記入する。
- 全項目 ○ であることをもって、6.4.11・6.4.12 の**実装完了**とする。
- WBS の更新は `apps/qr-attendance/docs/FE_DEVICE_MATRIX_AND_HYBRID_UI.md` の「7. マスターWBS（31行）」に反映済みである。
