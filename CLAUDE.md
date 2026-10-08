# CLAUDE.md

## プロジェクトの概要

AI の質問に答えるだけで日記が書ける、少人数（今は 2 人）で使うアプリ。詳しい構成・データモデル・設定値は [README.md](README.md)、Cloudflare のセットアップは [docs/setup.md](docs/setup.md) を参照する。

- `src/client/`: React SPA（Vite・TanStack Router / Query・Tailwind CSS）
  - `components/ui/`: shadcn/ui の部品。`npx shadcn@latest add <部品名>` で追加し、色は `index.css` のテーマ変数（stone・amber）で決める
- `src/worker/`: Cloudflare Worker（Hono）。`/api/*` を処理し、それ以外は静的アセットを返す
  - `ai/`: Workers AI（メイン）と Gemini（予備）のプロバイダ、フォールバック、プロンプト
  - `db/`: Drizzle のスキーマ（`schema.ts`）と、テーブルごとのデータアクセス（`entries.ts`・`notes.ts` など）。クエリはここにだけ書き、`routes/` からは `drizzle-orm` を使わない
- `src/shared/`: クライアントと Worker で共有する Zod スキーマ・定数・型
- `test/`: Vitest。`@cloudflare/vitest-pool-workers` で Workers ランタイムとローカル D1 を使い、AI はモックする

### 守るべき制約

- **完全無料で運用する**: 有料プラン・従量課金のサービスや API を追加しない。AI の呼び出しは `AI_DAILY_LIMIT` で日ごとに制限している。無料枠に関わる変更には `free-tier` ラベルを付ける
- **生成ファイルは手で編集しない**: `src/client/routeTree.gen.ts`（TanStack Router）、`worker-configuration.d.ts`（`npm run cf-typegen`）、`migrations/`（`npm run db:generate`）
- **スキーマを変えたらマイグレーションを生成する**: `src/worker/db/schema.ts` を変えたら `npm run db:generate` を実行し、生成された SQL もコミットする
- **`wrangler.jsonc` を変えたら型を更新する**: `npm run cf-typegen` を実行する
- **データは必ずユーザーごとに分ける**: 利用者は `users` テーブルに登録した人だけで、アプリにログイン画面はない（本番は Cloudflare Access で保護し、Worker が JWT を検証してユーザーを決める）。ユーザーのデータを持つテーブルには `user_id` を持たせ、すべてのクエリを `c.get("userId")` で絞り込む（`src/worker/db/` の関数は `(db, userId, ...)` を受け取り、必ず `userId` で絞り込む）。API の返り値に `user_id` を含めない

### よく使うコマンド

| コマンド                   | 内容                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run dev`              | 開発サーバー（Workers AI はリモートで動くので `npx wrangler login` が必要）                        |
| `npm run dev:local`        | Cloudflare に接続しない開発サーバー（AI は `.dev.vars` の Gemini だけ）                            |
| `npm run check`            | Biome の lint・フォーマットと、Prettier（Markdown・YAML）のチェック（`npm run format` で自動修正） |
| `npm run spell`            | cspell のスペルチェック（正しい単語が指摘されたら `cspell.config.yaml` の `words` に足す）         |
| `npm run knip`             | 未使用のファイル・export・依存関係の検出（設定は `knip.json`）                                     |
| `npm run build`            | 型チェック（`tsc -b`）とビルド                                                                     |
| `npm test`                 | テスト（AI はモックするので無料枠を消費しない）                                                    |
| `npm run test:coverage`    | カバレッジ付きでテスト（結果は `coverage/index.html`）                                             |
| `npm run db:generate`      | スキーマの変更からマイグレーションを生成                                                           |
| `npm run db:migrate:local` | ローカルの D1 にマイグレーションを適用                                                             |
| `npm run cf-typegen`       | `wrangler.jsonc` から `worker-configuration.d.ts` を生成                                           |

本番への反映（`npm run deploy`、`npm run db:migrate:remote`）は本番環境を変えるので、ユーザーに頼まれたときだけ実行する。

## issue・PR の運用

main ブランチは保護されていて直接 push できない。変更は必ず「issue を作る → ブランチを切る → PR を作る」の順で進める。

### 作成時に必ず付ける情報

issue と PR を作るときは、次の情報を作成と同時に付ける（後から付け足さない）。

| 項目             | issue                                                        | PR                                              |
| ---------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| ラベル           | 種類ラベルを 1 つ必須。該当すれば `free-tier` も付ける       | issue と同じラベル                              |
| 担当者           | `@me`                                                        | `@me`                                           |
| マイルストーン   | 対応するバージョン（下記）                                   | issue と同じマイルストーン                      |
| Project          | `kaitokune開発プロジェクト`                                  | `kaitokune開発プロジェクト`                     |
| 本文             | `.github/ISSUE_TEMPLATE/` のテンプレートの見出しに沿って書く | `.github/pull_request_template.md` に沿って書く |
| issue との紐付け | -                                                            | 本文に `Closes #<issue 番号>` を書く            |

```sh
gh issue create --title "..." --label enhancement --assignee @me \
  --milestone v0.1.0 --project "kaitokune開発プロジェクト" --body "..."
gh pr create --base main --title "..." --label enhancement --assignee @me \
  --milestone v0.1.0 --project "kaitokune開発プロジェクト" --body "..."
```

作成後に `gh issue view` / `gh pr view` でラベル・担当者・マイルストーン・Project が付いていることを確認する。

ラベル・担当者・マイルストーン・Project（PR では `Closes #` も）が欠けた `gh issue create` / `gh pr create` は、`.claude/hooks/check-gh-metadata.sh` の hook が実行前に止める。

### マイルストーン

マイルストーンはバージョン単位で、「ここまでできたら一区切り」という目標ごとにまとめる。

バージョンは[セマンティックバージョニング](https://semver.org/lang/ja/)に従い、`v<MAJOR>.<MINOR>.<PATCH>`（例: `v0.1.0`）と書く。

- MAJOR: 保存済みの日記が読めなくなる、使い方が大きく変わるなど、後方互換性のない変更
- MINOR: 機能の追加・改善
- PATCH: 不具合の修正だけ
- 1.0.0 になるまで（`v0.x.y`）は、後方互換性のない変更も MINOR を上げて扱う

- 開いているマイルストーンは `gh api repos/ohiaeni/kaitokune/milestones --jq '.[] | "\(.title): \(.description)"'` で確認し、内容が合うものを選ぶ
- どのマイルストーンにも合わない、または新しいバージョンを切るべきだと思ったら、勝手に作らずユーザーに確認する

### リリース

リリースは `/release` スキル（`.claude/skills/release/SKILL.md`）で行う。main の CI が通っていることを確かめ、タグ名と対象のコミットをユーザーに確認してから、タグを作って push する。本番環境に影響するので、ユーザーが `/release` で呼んだときだけ行う。

| 種類                            | タグ                                                       | タグを push すると                                                                                           |
| ------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| ベータ版（`/release beta`）     | `v<MAJOR>.<MINOR>.<PATCH>-beta.<N>`（例: `v0.2.0-beta.1`） | `release.yml` がリリースノートの下書き（draft の pre-release）を作る。デプロイはしない                       |
| 本番版（`/release production`） | `v<MAJOR>.<MINOR>.<PATCH>`（例: `v0.2.0`）                 | `release.yml` がリリースノートを公開し、`deploy.yml` が本番にデプロイする（D1 のマイグレーションも適用する） |

- バージョンはマイルストーンと同じ名前にする。本番版を出したらマイルストーンを閉じる
- リリースノートは直前の本番版からの PR を、ラベルごと（`.github/release.yml`）に分類して自動生成する
- 上の 2 つ以外の形のタグでは Release を作らず、ベータ版のタグではデプロイしない
- `v*` のタグはルールセットで保護されていて、作成・削除・付け替えは管理者だけができる
- デプロイ用の Secrets は production の Environment にあり、未登録ならデプロイは飛ばされる

### ラベル

ここにあるラベルだけを使う。新しいラベルが必要になったら、勝手に作らずユーザーに確認する。

| ラベル          | 種類ラベル | 用途                                                             | 対応するコミットの型           |
| --------------- | ---------- | ---------------------------------------------------------------- | ------------------------------ |
| `bug`           | ○          | 不具合・期待どおりに動かない                                     | `fix`                          |
| `enhancement`   | ○          | 新機能・既存機能の改善                                           | `feat`, `refactor`             |
| `documentation` | ○          | README・docs などのドキュメント                                  | `docs`                         |
| `chore`         | ○          | CI・ツール・テスト・設定などの雑務                               | `chore`, `style`, `ci`, `test` |
| `dependencies`  | ○          | 依存関係の更新（基本は Dependabot が付ける）                     | `chore(deps)`                  |
| `free-tier`     | -          | 無料枠・課金に関わる（完全無料運用の維持）。種類ラベルと併用する | -                              |

### ブランチ・コミット・PR のタイトル

- ブランチ名: `<型>/<内容を表す英語の kebab-case>`（例: `chore/dependabot-labels`）
- コミットメッセージと PR タイトル: `<型>: <日本語の要約>`（例: `fix: Workers AI の提供終了モデルを Gemma 4 に変更`）
- マージは squash だけで、PR のタイトルがそのまま main のコミットメッセージになる。マージ後のブランチは自動で削除される
- PR を作る前に `npm run check` / `npm run spell` / `npm run build` / `npm test` を実行し、通ったことを PR テンプレートのチェック項目に反映する
- コミット時に lefthook の pre-commit フックが Biome と Prettier（Markdown・YAML）、cspell を実行し、整形は自動で直す。lint エラーやスペルミスで止まったらコード（正しい単語なら `cspell.config.yaml`）を直してからコミットし直す（`--no-verify` で飛ばさない）

### git worktree

複数のブランチを並行して作業するときは、worktree を `.claude/worktree/` の下に作る。ほかの場所（リポジトリの外や一時ディレクトリ）には作らない。`.claude/worktree/` は `.gitignore` に入れてあり、Biome・Prettier・cspell・knip の対象外になる。

- 作成: `git worktree add .claude/worktree/<ブランチ名の / を - にしたもの> -b <ブランチ名>`（例: `git worktree add .claude/worktree/chore-worktree-dir -b chore/worktree-dir`）。作ったら中で `npm install` する
- 片付け: PR がマージされたら `git worktree remove .claude/worktree/<名前>` で消し、`git branch -D <ブランチ名>` でローカルのブランチも消す
- 消し忘れは `ls .claude/worktree` か `git worktree list` で確かめる。ディレクトリを直接消してしまったときは `git worktree prune` で記録を整理する

## GitHub Actions

- Action はタグではなくコミット SHA で指定し、末尾にバージョンをコメントで書く（例: `actions/checkout@<40 桁の SHA> # v7.0.1`）
- SHA は `gh api repos/<owner>/<repo>/commits/<タグ> --jq .sha` で調べる。更新は Dependabot に任せる
- リポジトリの設定で SHA 指定が必須になっているので、タグ指定の Action はワークフローの実行時にエラーになる
