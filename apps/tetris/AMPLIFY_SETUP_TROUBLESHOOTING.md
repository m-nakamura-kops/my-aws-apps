# AWS Amplify リポジトリ接続トラブルシューティング

## 問題: リポジトリが選択肢に表示されない

`m-nakamura-kops/my-aws-apps`がリポジトリプルダウンに表示されない場合の対処方法です。

## 🔧 解決方法

### 方法1: GitHubアカウントを接続する

1. **AWS Amplifyコンソールにアクセス**
   - https://console.aws.amazon.com/amplify/

2. **「新しいアプリ」→「GitHubからホスト」を選択**

3. **「GitHubを接続」をクリック**
   - 初回の場合、GitHubのOAuth認証画面が表示されます
   - GitHubアカウントでログイン
   - AWS Amplifyにアクセスを許可

4. **接続後、リポジトリを再読み込み**
   - リポジトリプルダウンを更新
   - `m-nakamura-kops/my-aws-apps`が表示されるはずです

### 方法2: GitHubアカウント接続を確認する

1. **AWS Amplifyコンソールの設定を確認**
   - 左メニューから「設定」→「GitHub」を選択
   - 接続されているGitHubアカウントを確認

2. **接続されていない場合**
   - 「GitHubを接続」をクリック
   - OAuth認証を完了

### 方法3: リポジトリの権限を確認する

1. **GitHubでリポジトリの設定を確認**
   - https://github.com/m-nakamura-kops/my-aws-apps/settings
   - 「Collaborators」でアクセス権限を確認

2. **AWS Amplifyに必要な権限**
   - リポジトリへの読み取り権限が必要
   - リポジトリがプライベートの場合、明示的な権限設定が必要

### 方法4: 手動でリポジトリURLを入力する

1. **「リポジトリを手動で追加」を選択**
   - リポジトリURLを直接入力:
     ```
     https://github.com/m-nakamura-kops/my-aws-apps.git
     ```
   - または:
     ```
     git@github.com:m-nakamura-kops/my-aws-apps.git
     ```

2. **認証情報を設定**
   - GitHub Personal Access Tokenが必要な場合があります

### 方法5: GitHub Personal Access Tokenを使用する

1. **GitHubでPersonal Access Tokenを作成**
   - https://github.com/settings/tokens
   - 「Generate new token (classic)」をクリック
   - スコープ: `repo`（すべてのリポジトリへのアクセス）

2. **Amplifyでトークンを使用**
   - 「リポジトリを手動で追加」を選択
   - 認証方法で「Personal Access Token」を選択
   - トークンを入力

## 🔍 確認事項

### GitHub側の確認

- [ ] GitHubアカウントにログインできているか
- [ ] リポジトリが存在するか（https://github.com/m-nakamura-kops/my-aws-apps）
- [ ] リポジトリへのアクセス権限があるか
- [ ] リポジトリがプライベートの場合、権限設定が正しいか

### AWS Amplify側の確認

- [ ] GitHubアカウントが接続されているか
- [ ] 正しいAWSリージョンを選択しているか
- [ ] ブラウザのキャッシュをクリアして再試行

## 📝 代替案: デプロイ方法

### オプション1: Vercelを使用する（推奨）

Next.jsアプリの場合、Vercelが最も簡単です：

1. https://vercel.com にアクセス
2. GitHubアカウントでログイン
3. 「New Project」をクリック
4. `m-nakamura-kops/my-aws-apps`を選択
5. 「Root Directory」を`apps/tetris`に設定
6. 「Deploy」をクリック

### オプション2: AWS Amplify CLIを使用する

コマンドラインからデプロイ：

```bash
# Amplify CLIをインストール
npm install -g @aws-amplify/cli

# Amplifyを初期化
cd /Users/masahiro/MySelector
amplify init

# ホスティングを追加
amplify add hosting

# デプロイ
amplify publish
```

### オプション3: GitHub Actionsを使用する

GitHub ActionsでAWSにデプロイするワークフローを作成することもできます。

## 🆘 サポート

問題が解決しない場合：

1. AWS Amplifyのドキュメントを確認
   - https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html

2. GitHubの接続設定を確認
   - https://docs.aws.amazon.com/amplify/latest/userguide/setting-up-GitHub-access.html

3. AWSサポートに問い合わせ
