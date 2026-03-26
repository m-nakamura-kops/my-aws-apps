# GitHub Push Protection エラー対応（シークレット削除）

## 実施した修正

次のファイルから **実際の Azure キーをプレースホルダに置き換え** 済みです。

- **POLARIS_SETUP_GUIDE.md**  
  - Azure OpenAI Key / Storage Account Key / Form Recognizer Key / Search Admin Key を  
    `<your-azure-...-key>` 形式に変更
- **env.template**  
  - 上記と同じキーを同様のプレースホルダに変更

**重要**: 実際のキーは **ローカルの `.env` にだけ** 設定し、`.env` は `.gitignore` に含めてリポジトリにコミットしないでください。

---

## Push を通す手順（履歴からシークレットを消す）

GitHub は「過去のコミット 60c8f9c にシークレットが含まれている」とブロックしています。  
以下のいずれかで、**そのコミットの内容を「プレースホルダ版」に書き換えてから** push してください。

### パターン A: 60c8f9c が「いまの最新コミット」の場合

```bash
cd /Users/masahiro/MySelector   # またはリポジトリのルート

# 修正済みファイルをステージ
git add POLARIS_SETUP_GUIDE.md env.template

# 最新コミットを修正（中身だけ差し替え）
git commit --amend --no-edit

# 再度 push（必要なら force）
git push origin main
# 拒否される場合は: git push --force-with-lease origin main
```

### パターン B: 60c8f9c よりあとにコミットがある場合（rebase で 60c8f9c を書き換える）

```bash
cd /Users/masahiro/MySelector

# 60c8f9c の1つ前のコミットを確認
git log --oneline 60c8f9c^..HEAD

# 60c8f9c を編集対象にして rebase 開始（<親のハッシュ> は git log で確認）
git rebase -i 60c8f9c^

# エディタで 60c8f9c の行を pick → edit に変更して保存

# 止まったら、いまのワークツリーの内容でそのコミットを上書き
git add POLARIS_SETUP_GUIDE.md env.template
git commit --amend --no-edit
git rebase --continue

# コンフリクトが出たら解消してから git rebase --continue

# 最後に push（履歴が変わっているので force が必要）
git push --force-with-lease origin main
```

---

## 今後シークレットを入れないために

- `env.template` には **プレースホルダだけ** を書く
- 実際のキーは `.env` にだけ書き、`.env` は必ず `.gitignore` に含める
- ドキュメント（POLARIS_SETUP_GUIDE.md 等）にも **サンプルやプレースホルダ** のみ記載する
