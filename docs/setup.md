# セットアップ手順

kaitokune をローカルで動かし、Cloudflare にデプロイして自分だけが使える状態にするまでの手順です。すべて無料の範囲で完結します。

Cloudflare や Google のダッシュボードは画面構成や項目名がよく変わります。この手順書の項目名が見当たらない場合は、近い名前のメニューを探してください。

| ステップ | 内容 | 所要時間の目安 |
| --- | --- | --- |
| [1](#1-必要なもの) | 必要なものを用意する | – |
| [2](#2-リポジトリを取得してインストールする) | リポジトリを取得してインストールする | 3 分 |
| [3](#3-cloudflare-アカウントを作成する) | Cloudflare アカウントを作成する | 5 分 |
| [4](#4-wrangler-で-cloudflare-にログインする) | Wrangler で Cloudflare にログインし、workers.dev のサブドメインを登録する | 3 分 |
| [5](#5-任意gemini-api-キーを発行する) | （任意）Gemini API キーを発行する | 3 分 |
| [6](#6-ローカルで動かす) | ローカルで動かす | 3 分 |
| [7](#7-本番用の-d1-データベースを作成する) | 本番用の D1 データベースを作成する | 2 分 |
| [8](#8-デプロイする) | デプロイする | 2 分 |
| [9](#9-cloudflare-access-で自分だけに制限する) | **Cloudflare Access で自分だけに制限する（必須）** | 5 分 |
| [10](#10-無料枠の使用量を確認する) | 無料枠の使用量を確認する | – |

> [!IMPORTANT]
> どのサービスにも**クレジットカード（支払い方法）を登録しないでください。** 未登録であれば、無料枠を超えても課金されずにエラーになるだけです。
> 例外として、手順 9 の Cloudflare Zero Trust では、初回設定時に支払い方法の登録を求められる場合があります。詳しくは[手順 9 の注意](#カードを登録したくない場合)を参照してください。

---

## 1. 必要なもの

- **Node.js 22 以上**（`node -v` で確認）。npm は Node.js に付属のもので構いません
- **Git**
- **メールアドレス**（Cloudflare アカウント用）
- （任意）**Google アカウント**（Gemini API キーを発行する場合）

## 2. リポジトリを取得してインストールする

```sh
git clone <このリポジトリの URL> kaitokune
cd kaitokune
npm install
```

npm 11 以降では、パッケージのインストールスクリプトがデフォルトでブロックされます。ローカル実行環境に必要な `workerd` と `esbuild` は、`package.json` の `allowScripts` ですでに許可しています。依存関係を更新したあとに次の警告が出た場合は、新しいバージョンをあらためて許可してください。

```text
npm warn install-scripts   workerd@x.y.z (postinstall: node install.js)
```

```sh
npm install-scripts approve workerd esbuild
npm rebuild workerd esbuild
```

## 3. Cloudflare アカウントを作成する

1. <https://dash.cloudflare.com/sign-up> でメールアドレスとパスワードを入力して登録する
2. 届いた確認メールのリンクを開いて、メールアドレスを認証する
3. ダッシュボードが開けば完了。ドメインの追加やプランの購入を勧められても、**すべてスキップして構いません**

Workers・D1・Workers AI は、どれもアカウントを作った時点で無料プラン（Workers Free）として使えます。個別の申し込みは不要です。

## 4. Wrangler で Cloudflare にログインする

Wrangler は Cloudflare の公式 CLI です。プロジェクトの依存関係に含まれているので、`npx wrangler` で実行できます。

```sh
npx wrangler login
```

ブラウザが開くので、手順 3 のアカウントでログインし、アクセスを許可（Allow）します。ログインできたか確認します。

```sh
npx wrangler whoami
```

メールアドレスとアカウント名が表示されれば成功です。

### 4-2. workers.dev のサブドメインを登録する（初回のみ）

`npm run dev` で Workers AI をリモートに接続するときと、本番にデプロイするときに、アカウントの workers.dev サブドメインが必要です。

1. ダッシュボードの **Workers & Pages** を開く（初回は Workers のオンボーディング画面が表示されます）
2. 好きなサブドメイン名（例: `your-name`）を入力して登録する

登録したサブドメインは、本番の URL `https://kaitokune.<サブドメイン>.workers.dev` に使われます。サブドメインの登録だけならアプリは公開されません。

> [!NOTE]
> Workers AI はローカル開発中も Cloudflare 上で実行されるため、`npm run dev` にはログインとサブドメインの登録が必要です。開発中の AI 呼び出しも自分のアカウントの無料枠から消費されます。

## 5. （任意）Gemini API キーを発行する

Workers AI がエラーになったときの予備として、Google の Gemini API を使えます。設定しなくてもアプリは動きます。

1. <https://aistudio.google.com/apikey> を開き、Google アカウントでログインする
2. 「API キーを作成（Create API key）」を押してキーを発行する
3. キーをコピーし、プロジェクトの `.dev.vars` に書き込む

```sh
cp .dev.vars.example .dev.vars
```

```ini
# .dev.vars（git 管理外）
GEMINI_API_KEY=発行したキー
```

> [!WARNING]
>
> - Google AI Studio で**課金（Billing）を有効にしないでください**。有効にしなければ無料ティアのままで、上限に達すると 429 エラーになるだけです。
> - 無料ティアでは、送信した内容が Google の品質改善に使われる可能性があります。日記の内容を送りたくない場合は、このステップを飛ばしてください。

## 6. ローカルで動かす

```sh
npm run db:migrate:local   # ローカルの D1（.wrangler/ 内の SQLite）にテーブルを作る
npm run dev                # http://localhost:5173 で起動
```

ブラウザで <http://localhost:5173> を開き、AI から最初の質問が表示されれば成功です。

| こんなとき | 使うコマンド |
| --- | --- |
| 通常の開発（Workers AI を使う） | `npm run dev` |
| Cloudflare にログインせずに試したい | `npm run dev:local`（Workers AI は使えず、手順 5 の Gemini だけで動く） |
| テストを実行したい | `npm test`（AI はモックするので無料枠を消費しない） |

ローカルのデータは `.wrangler/state/` に保存されます。消したいときはこのディレクトリを削除して、`npm run db:migrate:local` をやり直してください。

## 7. 本番用の D1 データベースを作成する

```sh
npx wrangler d1 create kaitokune
```

次のような出力が表示されます。

```text
✅ Successfully created DB 'kaitokune'
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "kaitokune",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  ]
}
```

表示された `database_id` を、`wrangler.jsonc` の `00000000-0000-0000-0000-000000000000` と置き換えます。この ID は秘密情報ではないので、そのままコミットして構いません。

```jsonc
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "kaitokune",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "migrations_dir": "migrations"
    }
  ],
```

本番のデータベースにテーブルを作ります。

```sh
npm run db:migrate:remote
```

## 8. デプロイする

手順 5 で Gemini のキーを発行した場合は、本番用のシークレットとして登録します（`.dev.vars` は本番には使われません）。

```sh
npx wrangler secret put GEMINI_API_KEY
# プロンプトにキーを貼り付けて Enter
```

ビルドしてデプロイします。

```sh
npm run deploy
```

完了すると、[手順 4-2](#4-2-workersdev-のサブドメインを登録する初回のみ) で登録したサブドメインを使った次の URL が表示されます。

```text
https://kaitokune.<サブドメイン>.workers.dev
```

> [!CAUTION]
> **この時点では、URL を知っている人なら誰でも日記を読み書きできます。** アプリ自体にはログイン機能がないので、続けて手順 9 を必ず行ってください。

## 9. Cloudflare Access で自分だけに制限する

Cloudflare Access（Zero Trust の機能）を使うと、アプリの前にログイン画面が挟まり、許可したメールアドレスの人しかアクセスできなくなります。Free プランは 50 ユーザーまで無料です。

### 9-1. Zero Trust を初期設定する（初回のみ）

1. Cloudflare ダッシュボードの左メニューから **Zero Trust** を開く
2. チーム名（例: `your-name`）を決める。ログイン画面の URL（`<チーム名>.cloudflareaccess.com`）に使われます
3. プランの選択で **Free** を選ぶ

### 9-2. workers.dev に Access を有効にする

1. ダッシュボードで **Workers & Pages** → **kaitokune** → **Settings** → **Domains & Routes** を開く
2. `workers.dev` の行のメニュー（`⋯`）から **Cloudflare Access** を有効にする
3. 有効にすると Access アプリケーションが自動で作成されます。表示されるリンク（**Manage Cloudflare Access**）からその設定を開く

### 9-3. 自分のメールアドレスだけを許可する

1. 作成された Access アプリケーションの **Policies** を開き、ポリシーを編集する
2. **Include** のルールを **Emails** にし、自分のメールアドレスだけを入力する
3. 保存する

ログイン方法は、デフォルトの **One-time PIN**（メールに届くコードで認証する方式）のままで構いません。

### 9-4. 制限されていることを確認する

1. ブラウザのシークレットウィンドウで `https://kaitokune.<サブドメイン>.workers.dev` を開く
2. アプリではなく Cloudflare Access のログイン画面が表示されることを確認する
3. 自分のメールアドレスを入力し、届いたコードでログインできることを確認する
4. 別のメールアドレスではコードが届かない（ログインできない）ことも確認しておくと安心です

### カードを登録したくない場合

Zero Trust の初回設定（9-1）で、Free プランでも支払い方法の登録を求められる場合があります。Free プランのままなら請求は発生しませんが、「カードを一切登録しない」方針を守りたい場合は、Access を使わない別の保護方法が必要です。その場合は、アプリ側にパスワード認証（Hono の Basic 認証など）を追加する対応を検討してください（現時点では未実装）。

## 10. 無料枠の使用量を確認する

| 確認したいもの | 場所 |
| --- | --- |
| Workers AI の使用量（Neurons） | ダッシュボード → **AI** → **Workers AI** |
| Worker のリクエスト数・エラー | ダッシュボード → **Workers & Pages** → **kaitokune** → **Metrics** |
| D1 の読み書き・容量 | ダッシュボード → **Storage & Databases** → **D1** → **kaitokune** |
| Gemini の使用量 | Google AI Studio の使用量（Usage）ページ |
| 本番のログをリアルタイムで見る | `npx wrangler tail` |

アプリ側でも、AI の呼び出しを 1 日 `AI_DAILY_LIMIT` 回（初期値 50 回）までに制限しています。日記 1 日分で使うのは最大 6 回程度です。変える場合は `wrangler.jsonc` の `vars` を編集して、もう一度デプロイしてください。

---

## 更新したときのデプロイ

```sh
# DB スキーマ（src/worker/db/schema.ts）を変えた場合だけ
npm run db:generate          # migrations/ に SQL が生成される
npm run db:migrate:local     # ローカルで確認
npm run db:migrate:remote    # 本番に適用

# wrangler.jsonc を変えた場合だけ
npm run cf-typegen           # worker-configuration.d.ts を更新

# 毎回
npm run check && npm run typecheck && npm test
npm run deploy
```

## トラブルシューティング

| 症状 | 原因と対処 |
| --- | --- |
| `npm run dev` が `it's necessary to set a CLOUDFLARE_API_TOKEN` で止まる | Cloudflare にログインしていません。`npx wrangler login` を実行するか、`npm run dev:local` を使ってください |
| `npm run dev` が `You need to register a workers.dev subdomain` / `Failed to start the remote proxy session` で止まる | workers.dev のサブドメインが未登録です。エラーに表示される URL か、[手順 4-2](#4-2-workersdev-のサブドメインを登録する初回のみ) の方法で登録してから、もう一度実行してください |
| 画面に「AI に接続できませんでした」と出る（API は 502） | すべての AI プロバイダが失敗しています。ターミナル（本番では `npx wrangler tail`）に `AI provider ... failed` と原因が出ます |
| ログに `Binding AI needs to be run remotely` と出る | `npm run dev:local` では Workers AI を使えません。Gemini のキーを設定するか、`npm run dev` を使ってください |
| ログにモデルが見つからないというエラーが出る | `WORKERS_AI_MODEL` のモデルが提供終了している可能性があります。`npx wrangler ai models` で現在のモデルを確認して変更してください |
| 「今日の AI 利用上限に達しました」と出る（API は 429） | `AI_DAILY_LIMIT` に達しました。`TIMEZONE` の日付が変わるとリセットされます |
| デプロイ時に D1 のデータベースが見つからないと出る | `wrangler.jsonc` の `database_id` が仮の値のままです。手順 7 を行ってください |
| `requires compatibility date "..."` で起動しない | `wrangler.jsonc` の `compatibility_date` がローカルの実行環境より新しすぎます。表示された日付以前に下げてください |
| 本番で日記一覧などが空になる | ローカルと本番の D1 は別のデータベースです。ローカルで書いた日記は本番には反映されません |
