# コントリビュートガイド

kaitokune は少人数で使うための個人開発のアプリです。開発の進め方を簡単にまとめます。詳しいルールは [CLAUDE.md](CLAUDE.md)、アプリの構成は [README.md](README.md)、Cloudflare のセットアップは [docs/setup.md](docs/setup.md) を参照してください。

## 守ること

- **完全無料で運用する**: 有料プラン・従量課金のサービスや API を追加しない。無料枠に関わる変更には `free-tier` ラベルを付ける
- **データはユーザーごとに分ける**: ユーザーのデータを持つテーブルには `user_id` を持たせ、すべてのクエリをログインしているユーザーで絞り込む
- **生成ファイルは手で編集しない**: `src/client/routeTree.gen.ts`・`worker-configuration.d.ts`・`migrations/` はコマンドで生成する
- 脆弱性は issue ではなく [SECURITY.md](SECURITY.md) の方法で報告する

## 変更の進め方

main ブランチは保護されていて直接 push できません。変更は「issue を作る → ブランチを切る → PR を作る」の順で進めます。

1. **issue を作る**: テンプレート（不具合の報告・機能の提案）の見出しに沿って書き、種類ラベル（`bug`・`enhancement`・`documentation`・`chore`・`dependencies`）を 1 つ付ける
2. **ブランチを切る**: `<型>/<内容を表す英語の kebab-case>`（例: `fix/compose-timeout`）
3. **コミットする**: メッセージは `<型>: <日本語の要約>`（例: `fix: Workers AI の提供終了モデルを Gemma 4 に変更`）。型は `feat`・`fix`・`refactor`・`docs`・`chore`・`style`・`ci`・`test` など
4. **PR を作る**: タイトルはコミットメッセージと同じ形にし、本文はテンプレートに沿って書き、`Closes #<issue 番号>` で issue と紐付ける
5. **マージする**: squash だけで、PR のタイトルがそのまま main のコミットメッセージになる

コミット時は lefthook の pre-commit フックが Biome・Prettier（Markdown・YAML）・cspell を実行します。止まったら原因を直してコミットし直してください（`--no-verify` で飛ばさない）。

## よく使うコマンド

| コマンド              | 内容                                                                             |
| --------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`         | 開発サーバー（Workers AI を使うので `npx wrangler login` が必要）                |
| `npm run dev:local`   | Cloudflare に接続しない開発サーバー（AI は `.dev.vars` の Gemini だけ）          |
| `npm run check`       | Biome の lint・フォーマットと Prettier のチェック（`npm run format` で自動修正） |
| `npm run spell`       | cspell のスペルチェック                                                          |
| `npm run build`       | 型チェックとビルド                                                               |
| `npm test`            | テスト（AI はモックするので無料枠を消費しない）                                  |
| `npm run db:generate` | `src/worker/db/schema.ts` の変更からマイグレーションを生成                       |
| `npm run cf-typegen`  | `wrangler.jsonc` を変えたら実行し、型を更新                                      |

PR を作る前に `npm run check`・`npm run spell`・`npm run build`・`npm test` が通ることを確認してください。

## リリース

バージョンは[セマンティックバージョニング](https://semver.org/lang/ja/)に従い、マイルストーンと同じ名前のタグ（`v0.4.1` など）を push すると、リリースノートの生成と本番へのデプロイが行われます。タグを作れるのは管理者だけです。
