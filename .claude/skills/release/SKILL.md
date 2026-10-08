---
name: release
description: ベータ版または本番版のバージョンタグを main に作成して push する。ベータ版はリリースノートの下書きを作り、本番版はリリースノートを公開して本番にデプロイする。
argument-hint: "beta | production [バージョン（例: v0.2.0）]"
disable-model-invocation: true
---

# リリース（バージョンタグの作成と push）

引数: `$ARGUMENTS`

タグを push すると次のワークフローが動く。タグは一度 push すると簡単には取り消せず、本番版は本番環境を変えるので、手順 4 の確認を飛ばさない。

| 種類                   | タグ                                                       | 動くワークフロー                                                                      |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| ベータ版（`beta`）     | `v<MAJOR>.<MINOR>.<PATCH>-beta.<N>`（例: `v0.2.0-beta.1`） | `release.yml`: リリースノートの下書き（draft の pre-release）を作る。デプロイはしない |
| 本番版（`production`） | `v<MAJOR>.<MINOR>.<PATCH>`（例: `v0.2.0`）                 | `release.yml`: リリースノートを公開する / `deploy.yml`: 本番にデプロイする            |

リリースノートはどちらも、直前の本番版からの PR を、ラベルごとに分類して自動生成する（`.github/release.yml`）。

## 1. 種類を決める

- 引数の最初の単語が `beta` ならベータ版、`production` なら本番版
- どちらもない、または判別できなければ、AskUserQuestion でベータ版か本番版かを聞く

## 2. 前提を確かめる

次のどれかを満たさなければ、理由を伝えて止める。

```sh
git fetch origin --tags
git switch main && git pull --ff-only
git status --porcelain                       # 何も出ないこと
gh run list --branch main --workflow CI --limit 1 --json headSha,status,conclusion
```

- 作業ツリーがきれいである
- 手元の main が `origin/main` と同じコミットである
- main の最新コミット（`git rev-parse HEAD`）で CI が成功している（`headSha` が一致し、`conclusion` が `success`）。実行中なら終わるまで待つ

## 3. バージョンを決める

引数にバージョン（`v0.2.0` など）があればそれを使う。なければ開いているマイルストーンから決める。

```sh
gh api repos/ohiaeni/kaitokune/milestones --jq '.[] | "\(.number) \(.title) open=\(.open_issues) closed=\(.closed_issues)"'
```

- 開いているマイルストーンのうち、バージョンがいちばん小さいものを対象にする。複数あって迷う場合はユーザーに聞く
- バージョンは `v<MAJOR>.<MINOR>.<PATCH>` の形であること（セマンティックバージョニング）
- 本番版のタグ名: そのバージョン（例: `v0.2.0`）
  - すでに同じタグがあれば止める
  - マイルストーンに開いている issue が残っていれば、その一覧を見せて、それでも出すかをユーザーに確認する
- ベータ版のタグ名: `<バージョン>-beta.<N>`。`N` は既存のタグの最大の番号 + 1（なければ 1）

  ```sh
  git tag --list "v0.2.0-beta.*" | sed 's/.*-beta\.//' | sort -n | tail -1
  ```

  - 同じバージョンの本番版のタグがすでにあれば、ベータ版は作らずに止める（次のバージョンを使うよう伝える）

## 4. ユーザーに確認する

AskUserQuestion で、次の内容を見せてから進めてよいかを確認する。了承がなければ止める。

- 種類（ベータ版 / 本番版）とタグ名
- 対象のコミット（`git log -1 --oneline`）
- 直前の本番版のタグ（`git tag --list 'v*' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1`）と、そこからの PR の数（`git log --oneline <直前のタグ>..HEAD | wc -l`。直前のタグがなければ最初のリリース）
- 本番版なら「本番にデプロイされる」こと。デプロイ用の Secrets が未登録の場合（`gh secret list --env production` に `CLOUDFLARE_API_TOKEN` がない）は、Release だけ作られてデプロイは飛ばされることも伝える

## 5. タグを作って push する

注釈付きタグにする。`v*` のタグはルールセットで保護されていて、管理者だけが作成できる。

```sh
git tag -a <タグ名> -m "<タグ名>"
git push origin <タグ名>
```

push が拒否されたら、理由（権限・ルールセット）を伝えて止める。手元に作ったタグは `git tag -d <タグ名>` で消しておく。

## 6. ワークフローの結果を確かめる

```sh
gh run list --workflow release.yml --limit 1 --json databaseId,headBranch,status,conclusion,url
gh run watch <databaseId> --exit-status
```

- ベータ版: `release.yml` の成功を確かめ、下書きの URL を伝える（`gh release view <タグ名> --json url,isDraft,isPrerelease`）。下書きは GitHub の画面で内容を確かめてから、必要なら手で編集できる
- 本番版: `release.yml` と `deploy.yml` の両方の成功を確かめる
  - Release の URL を伝える
  - `deploy.yml` で「Deploy」ステップが実行されたか、Secrets 未登録で飛ばされたかを伝える（`gh run view <databaseId> --json jobs --jq '.jobs[0].steps[] | "\(.name): \(.conclusion)"'`）
  - 両方成功したら、マイルストーンを閉じる: `gh api -X PATCH repos/ohiaeni/kaitokune/milestones/<番号> -f state=closed`

どちらかが失敗したら、失敗したステップとログの要点を伝え、タグを消したり作り直したりはせずにユーザーの判断を待つ。

## 7. 報告する

作ったタグ、Release の URL、ワークフローの結果（本番版はデプロイの有無とマイルストーンを閉じたこと）を短くまとめて伝える。
