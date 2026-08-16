# ミニアプリが表示されない問題の原因と対策

## 問題の概要

ログイン後、`/miniapps`ページで「アプリが存在しません」と表示され、本来表示されるべき39件のミニアプリが表示されなかった。

## 症状

- ブラウザのコンソールに以下のエラーが表示：
  ```
  GET http://localhost:5001/api/miniapps/categories 500 (Internal Server Error)
  ```
- サーバーログに以下のエラーが記録：
  ```
  Error: Generated "enhance" function not found. Please run `zenstack generate` first.
  ```

## 原因

### 根本原因

**ZenStackの`enhance`関数が正しく読み込めていなかった**

### 詳細な原因

1. **ZenStackとは**
   - Prisma（データベース操作ツール）にアクセス制御機能を追加するツール
   - ユーザーごとにアクセス可能なデータを自動的にフィルタリングする

2. **enhance関数とは**
   - ZenStackが生成する関数で、通常のPrismaクライアントを拡張する
   - ユーザーの権限に基づいて、アクセス可能なデータだけを返すようにする

3. **問題の発生箇所**
   - `src/server/db.ts`で`@zenstackhq/runtime`から`enhance`をインポートしていた
   - `@zenstackhq/runtime`は`node_modules`内のパッケージで、実際の`enhance`関数は`.zenstack/enhance`から読み込もうとする
   - しかし、`node_modules/@zenstackhq/runtime/`から見ると、プロジェクトルートの`.zenstack/enhance`が見つからない

4. **エラーの連鎖**
   ```
   enhance関数が見つからない
   ↓
   getEnhancedPrismaForUser()がエラーを投げる
   ↓
   /api/miniapps/categories が500エラーを返す
   ↓
   フロントエンドでカテゴリとミニアプリが取得できない
   ↓
   「アプリが存在しません」と表示される
   ```

## 対策・修正内容

### 修正ファイル

`src/server/db.ts`

### 修正内容

`enhance`関数のインポート元を変更：

```typescript
// 修正前
import { enhance } from '@zenstackhq/runtime';

// 修正後
import { enhance } from '../../.zenstack/enhance';
```

### 修正の効果

- `.zenstack/enhance.js`を直接読み込むことで、`enhance`関数が正しく動作するようになった
- APIエンドポイント `/api/miniapps/categories` が正常に動作するようになった
- フロントエンドでカテゴリとミニアプリが正しく取得できるようになった
- 39件のミニアプリが正常に表示されるようになった

## 確認事項

### データベースの状態

- ✅ データベース接続：正常
- ✅ ミニアプリデータ：53件存在（うち39件がアクセス可能）
- ✅ ユーザーデータ：`admin@example.com`が正常に存在

### 修正後の動作確認

- ✅ `/api/miniapps/categories` が200ステータスを返す
- ✅ ミニアプリ一覧ページで39件のアプリが表示される
- ✅ カテゴリ別にアプリが正しく分類されて表示される

## 技術的な補足

### ZenStackの動作フロー

1. `zenstack generate`コマンドを実行
2. `.zenstack/enhance.js`が生成される（プロジェクト固有のアクセス制御ルールを含む）
3. アプリケーションで`enhance`関数を使用してPrismaクライアントを拡張
4. 拡張されたPrismaクライアントが、ユーザーの権限に基づいてデータをフィルタリング

### なぜ直接インポートが必要だったか

- `@zenstackhq/runtime`は汎用的なラッパーで、プロジェクト固有の`.zenstack/enhance`を見つけられない
- プロジェクトルートからの相対パスで直接インポートすることで、確実に生成された`enhance`関数を読み込める

## 今後の注意点

- `zenstack generate`を実行した後は、開発サーバーを再起動すること
- `.zenstack/enhance.js`が存在することを確認すること
- 同様のエラーが発生した場合は、`src/server/db.ts`のインポートパスを確認すること

