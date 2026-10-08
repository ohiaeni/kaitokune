# CLAUDE.md

## issue・PR の運用

main ブランチは保護されていて直接 push できない。変更は必ず「issue を作る → ブランチを切る → PR を作る」の順で進める。

### 作成時に必ず付ける情報

issue と PR を作るときは、次の情報を作成と同時に付ける（後から付け足さない）。

| 項目 | issue | PR |
| --- | --- | --- |
| ラベル | 種類ラベルを 1 つ必須。該当すれば `free-tier` も付ける | issue と同じラベル |
| 担当者 | `@me` | `@me` |
| マイルストーン | 対応するバージョン（下記） | issue と同じマイルストーン |
| Project | `kaitokune開発プロジェクト` | `kaitokune開発プロジェクト` |
| 本文 | `.github/ISSUE_TEMPLATE/` のテンプレートの見出しに沿って書く | `.github/pull_request_template.md` に沿って書く |
| issue との紐付け | - | 本文に `Closes #<issue 番号>` を書く |

```sh
gh issue create --title "..." --label enhancement --assignee @me \
  --milestone v0.1 --project "kaitokune開発プロジェクト" --body "..."
gh pr create --base main --title "..." --label enhancement --assignee @me \
  --milestone v0.1 --project "kaitokune開発プロジェクト" --body "..."
```

作成後に `gh issue view` / `gh pr view` でラベル・担当者・マイルストーン・Project が付いていることを確認する。

ラベル・担当者・マイルストーン・Project（PR では `Closes #` も）が欠けた `gh issue create` / `gh pr create` は、`.claude/hooks/check-gh-metadata.sh` の hook が実行前に止める。

### マイルストーン

マイルストーンはバージョン単位（`v0.1`、`v0.2` …）で、「ここまでできたら一区切り」という目標ごとにまとめる。

- 開いているマイルストーンは `gh api repos/ohiaeni/kaitokune/milestones --jq '.[] | "\(.title): \(.description)"'` で確認し、内容が合うものを選ぶ
- どのマイルストーンにも合わない、または新しいバージョンを切るべきだと思ったら、勝手に作らずユーザーに確認する

### ラベル

ここにあるラベルだけを使う。新しいラベルが必要になったら、勝手に作らずユーザーに確認する。

| ラベル | 種類ラベル | 用途 | 対応するコミットの型 |
| --- | --- | --- | --- |
| `bug` | ○ | 不具合・期待どおりに動かない | `fix` |
| `enhancement` | ○ | 新機能・既存機能の改善 | `feat`, `refactor` |
| `documentation` | ○ | README・docs などのドキュメント | `docs` |
| `chore` | ○ | CI・ツール・設定などコード以外の雑務 | `chore`, `style`, `ci` |
| `dependencies` | ○ | 依存関係の更新（基本は Dependabot が付ける） | `chore(deps)` |
| `free-tier` | - | 無料枠・課金に関わる（完全無料運用の維持）。種類ラベルと併用する | - |

### ブランチ・コミット・PR のタイトル

- ブランチ名: `<型>/<内容を表す英語の kebab-case>`（例: `chore/dependabot-labels`）
- コミットメッセージと PR タイトル: `<型>: <日本語の要約>`（例: `fix: Workers AI の提供終了モデルを Gemma 4 に変更`）
- PR を作る前に `npm run check` / `npm run build` / `npm test` を実行し、通ったことを PR テンプレートのチェック項目に反映する
