# セットアップ手順

kaitokune をローカルで動かし、Cloudflare にデプロイして、登録した人だけが使える状態にするまでの手順です。すべて無料の範囲で完結します。

Cloudflare や Google のダッシュボードは画面構成や項目名がよく変わります。この手順書の項目名が見当たらない場合は、近い名前のメニューを探してください。

| ステップ                                       | 内容                                                                      | 所要時間の目安 |
| ---------------------------------------------- | ------------------------------------------------------------------------- | -------------- |
| [1](#1-必要なもの)                             | 必要なものを用意する                                                      | –              |
| [2](#2-リポジトリを取得してインストールする)   | リポジトリを取得してインストールする                                      | 3 分           |
| [3](#3-cloudflare-アカウントを作成する)        | Cloudflare アカウントを作成する                                           | 5 分           |
| [4](#4-wrangler-で-cloudflare-にログインする)  | Wrangler で Cloudflare にログインし、workers.dev のサブドメインを登録する | 3 分           |
| [5](#5-任意gemini-api-キーを発行する)          | （任意）Gemini API キーを発行する                                         | 3 分           |
| [6](#6-ローカルで動かす)                       | ローカルで動かす                                                          | 3 分           |
| [7](#7-本番用の-d1-データベースを作成する)     | 本番用の D1 データベースを作成する                                        | 2 分           |
| [8](#8-デプロイする)                           | デプロイする                                                              | 2 分           |
| [9](#9-cloudflare-access-で使える人を制限する) | **Cloudflare Access で使える人を制限し、ユーザーを登録する（必須）**      | 10 分          |
| [10](#10-無料枠の使用量を確認する)             | 無料枠の使用量を確認する                                                  | –              |

> [!IMPORTANT]
> どのサービスにも**クレジットカード（支払い方法）を登録しないでください。** 未登録であれば、無料枠を超えても課金されずにエラーになるだけです。
> 例外として、手順 9 の Cloudflare Zero Trust では、初回設定時に支払い方法の登録を求められる場合があります。詳しくは[手順 9 の注意](#カードを登録したくない場合)を参照してください。

---

## 1. 必要なもの

- **Node.js 24 以上**（`node -v` で確認）。npm は Node.js に付属のもの（11 以上）を使います。npm 10 以下では `package.json` の `allowScripts` が効かず、`engines` の確認で `npm install` が止まります。nvm・fnm・mise などのバージョン管理ツールを使う場合は、リポジトリの `.node-version` を読み込めます
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
cp .dev.vars.example .dev.vars   # 手順 5 で作っていれば不要
npm run db:migrate:local         # ローカルの D1（.wrangler/ 内の SQLite）にテーブルを作る
npm run dev                      # http://localhost:5173 で起動
```

ローカルでは Cloudflare Access を通らないので、`.dev.vars` の `DEV_USER_EMAIL` に書いたメールアドレスのユーザーとして動きます。初期値の `owner@example.invalid` はマイグレーションで作られるユーザーなので、そのままで使えます。`DEV_USER_EMAIL` がないと、API はすべて 401（ログインを確認できませんでした）になります。

ブラウザで <http://localhost:5173> を開き、AI から最初の質問が表示されれば成功です。

| こんなとき                          | 使うコマンド                                                            |
| ----------------------------------- | ----------------------------------------------------------------------- |
| 通常の開発（Workers AI を使う）     | `npm run dev`                                                           |
| Cloudflare にログインせずに試したい | `npm run dev:local`（Workers AI は使えず、手順 5 の Gemini だけで動く） |
| テストを実行したい                  | `npm test`（AI はモックするので無料枠を消費しない）                     |

ローカルのデータは `.wrangler/state/` に保存されます。消したいときはこのディレクトリを削除して、`npm run db:migrate:local` をやり直してください。

## 7. 本番用の D1 データベースを作成する

```sh
npx wrangler d1 create kaitokune
```

途中で次のように、設定ファイルへの追記を提案されます。**`n`（No）を選んでください。**

```text
? Would you like Wrangler to add it on your behalf?
```

Yes を選ぶと、既存の `DB` とは別のバインディング（`kaitokune`）が追加され、ファイル全体の書式も変わってしまいます。アプリが使うのは `DB` なので、自動追記されたバインディングは使われず、`npm run db:migrate:remote` も古い ID を見て失敗します（`The database ... could not be found [code: 7404]`）。誤って Yes を選んだ場合は、追加されたバインディングを削除し、その `database_id` を次のように `DB` に移してください。

作成されたデータベースの ID は、次のコマンドでも確認できます。

```sh
npx wrangler d1 list
```

表示された ID（`uuid`）で、`wrangler.jsonc` の `DB` バインディングの `database_id` を置き換えます。この ID は秘密情報ではないので、そのままコミットして構いません。

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
> **この時点ではまだ使えません。** Worker は Access の設定がないと、API へのリクエストをすべて 401 で断ります（日記が誰かに読まれることはありません）。続けて手順 9 を必ず行ってください。

## 9. Cloudflare Access で使える人を制限する

Cloudflare Access（Zero Trust の機能）を使うと、アプリの前にログイン画面が挟まり、許可したメールアドレスの人しかアクセスできなくなります。Free プランは 50 ユーザーまで無料です。

Worker は Access が付ける JWT を検証してメールアドレスを確かめ、さらに D1 の `users` テーブルに登録された人だけを通します。日記はユーザーごとに分かれていて、ほかの人の日記は読めません。使えるようにするには、次の 3 つがすべて必要です。

- Access のポリシーでメールアドレスを許可する（9-3）
- Worker に Access の設定を登録する（9-5）
- `users` テーブルにメールアドレスを登録する（9-6）

### 9-1. Zero Trust を初期設定する（初回のみ）

1. Cloudflare ダッシュボードの左メニューから **Zero Trust** を開く
2. チーム名（例: `your-name`）を決める。ログイン画面の URL（`<チーム名>.cloudflareaccess.com`）に使われます
3. プランの選択で **Free** を選ぶ

### 9-2. workers.dev に Access を有効にする

1. ダッシュボードで **Workers & Pages** → **kaitokune** → **Settings** → **Domains & Routes** を開く
2. `workers.dev` の行のメニュー（`⋯`）から **Cloudflare Access** を有効にする
3. 有効にすると Access アプリケーションが自動で作成されます。表示されるリンク（**Manage Cloudflare Access**）からその設定を開く

### 9-3. 使う人のメールアドレスだけを許可する

1. 作成された Access アプリケーションの **Policies** を開き、ポリシーを編集する
2. **Include** のルールを **Emails** にし、使う人（自分ともう 1 人など）のメールアドレスだけを入力する
3. 保存する

ログイン方法は、デフォルトの **One-time PIN**（メールに届くコードで認証する方式）のままで構いません。

### 9-4. 制限されていることを確認する

1. ブラウザのシークレットウィンドウで `https://kaitokune.<サブドメイン>.workers.dev` を開く
2. アプリではなく Cloudflare Access のログイン画面が表示されることを確認する
3. 自分のメールアドレスを入力し、届いたコードでログインできることを確認する
4. 別のメールアドレスではコードが届かない（ログインできない）ことも確認しておくと安心です

### 9-5. Worker に Access の設定を登録する

Worker が JWT を検証するために、チームドメインと Access アプリケーションの AUD タグを登録します。

1. Zero Trust の **Settings** でチームドメイン（`https://<チーム名>.cloudflareaccess.com`）を確認する
2. **Access** → **Applications** で 9-2 のアプリケーションを開き、**Application Audience (AUD) Tag** をコピーする
3. Worker のシークレットに登録する

```sh
npx wrangler secret put ACCESS_TEAM_DOMAIN   # https://<チーム名>.cloudflareaccess.com を貼り付ける
npx wrangler secret put ACCESS_AUD           # 2 でコピーした AUD タグを貼り付ける
```

> [!WARNING]
> `DEV_USER_EMAIL` は本番に登録しないでください。`ACCESS_TEAM_DOMAIN` と `ACCESS_AUD` があれば無視されますが、それらを消すと JWT を検証せずにそのユーザーとして通してしまいます。

### 9-6. ユーザーを登録する

D1 の `users` テーブルに、使う人のメールアドレスを**小文字で**登録します。Access を通っても、ここにない人は 403（まだ登録されていません）になります。

マイグレーションで、最初のユーザー（id=1）が仮のメールアドレス `owner@example.invalid` で作られています。v0.2.0 以前に書いた日記はこのユーザーのものです。まず、これを自分のメールアドレスに書き換えます。

```sh
npx wrangler d1 execute kaitokune --remote \
  --command "UPDATE users SET email = 'you@example.com' WHERE id = 1"
```

もう 1 人を追加します（9-3 の Access のポリシーにも追加しておきます）。

```sh
npx wrangler d1 execute kaitokune --remote \
  --command "INSERT INTO users (email, created_at) VALUES ('partner@example.com', unixepoch() * 1000)"
```

登録されている人は次のコマンドで確認できます。

```sh
npx wrangler d1 execute kaitokune --remote --command "SELECT * FROM users"
```

> [!CAUTION]
> ユーザーを削除する（`DELETE FROM users WHERE ...`）と、その人の日記・会話ログ・メモもすべて消えます。使えなくするだけなら、Access のポリシーからメールアドレスを外してください。

### カードを登録したくない場合

Zero Trust の初回設定（9-1）で、Free プランでも支払い方法の登録を求められる場合があります。Free プランのままなら請求は発生しませんが、「カードを一切登録しない」方針を守りたい場合は、Access を使わない別の保護方法が必要です。その場合は、アプリ側にパスワード認証（Hono の Basic 認証など）を追加する対応を検討してください（現時点では未実装）。

## 10. 無料枠の使用量を確認する

| 確認したいもの                 | 場所                                                               |
| ------------------------------ | ------------------------------------------------------------------ |
| Workers AI の使用量（Neurons） | ダッシュボード → **AI** → **Workers AI**                           |
| Worker のリクエスト数・エラー  | ダッシュボード → **Workers & Pages** → **kaitokune** → **Metrics** |
| D1 の読み書き・容量            | ダッシュボード → **Storage & Databases** → **D1** → **kaitokune**  |
| Gemini の使用量                | Google AI Studio の使用量（Usage）ページ                           |
| 本番のログをリアルタイムで見る | `npx wrangler tail`                                                |

アプリ側でも、AI の呼び出しを 1 人 1 日 `AI_DAILY_LIMIT` 回（初期値 25 回）までに制限しています。ユーザーごとに数えるので、全体ではユーザー数 × `AI_DAILY_LIMIT` 回までです（2 人なら 50 回）。ユーザーを増やすときは、合計が無料枠に収まるように `AI_DAILY_LIMIT` を下げてください。日記 1 日分で使うのは最大 6 回程度です。変える場合は `wrangler.jsonc` の `vars` を編集して、もう一度デプロイしてください。

### アプリで確認する

アプリの「使用量」画面（`/usage`）で、今日の AI の呼び出し回数と、Cloudflare の無料枠（Workers のリクエスト数・Workers AI の Neurons・D1 の読み書き行数と容量）の消費状況を確認できます。Cloudflare の値は [GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/)（無料）から取得するので、初回だけ読み取り専用の API トークンを Worker に登録します。登録しなければ、AI の呼び出し回数だけが表示されます。

1. [Cloudflare のダッシュボード](https://dash.cloudflare.com/profile/api-tokens) の「My Profile」→「API Tokens」→「Create Token」→「Create Custom Token」を開く
2. 「Permissions」を「Account」→「Account Analytics」→「Read」だけにする（デプロイ用のトークンとは分け、ほかの権限は付けない）
3. 「Account Resources」を自分のアカウントだけにする
4. 「Continue to summary」→「Create Token」で発行し、表示されたトークンをコピーする
5. Worker のシークレットに登録する（アカウント ID は `npx wrangler whoami` で確認できます）

```sh
npx wrangler secret put CF_ANALYTICS_TOKEN   # 4 でコピーしたトークンを貼り付ける
npx wrangler secret put CF_ACCOUNT_ID        # アカウント ID を貼り付ける
```

シークレットは Worker に保存されるので、デプロイのたびに登録し直す必要はありません。ローカルで試すときは `.dev.vars` に同じ名前で書きます。

---

## 更新したときのデプロイ

### GitHub Actions でデプロイする（おすすめ）

リリースのタグ（`v0.1.0` など）を push すると、`.github/workflows/deploy.yml` がチェック・ビルド・テストを実行し、本番の D1 にマイグレーションを適用してからデプロイします。Actions タブの「Deploy」→「Run workflow」で、main を手動でデプロイすることもできます。

初回だけ、Cloudflare の API トークンを GitHub に登録します。登録するまでは、ワークフローは警告を出してデプロイを飛ばします。

1. [Cloudflare のダッシュボード](https://dash.cloudflare.com/profile/api-tokens) の「My Profile」→「API Tokens」→「Create Token」を開く
2. 「Edit Cloudflare Workers」テンプレートの「Use template」を選ぶ
3. 「Permissions」に「Account」→「D1」→「Edit」を追加する（マイグレーションの適用に必要）
4. 「Account Resources」を自分のアカウントだけ、「Zone Resources」を「All zones from an account」→ 自分のアカウントにする
5. 「Continue to summary」→「Create Token」で発行し、表示されたトークンをコピーする（この画面を閉じると二度と表示されません）
6. アカウント ID を確認する（ダッシュボードの「Workers & Pages」の右側、または `npx wrangler whoami`）
7. GitHub の production の Environment に Secrets として登録する

```sh
gh secret set CLOUDFLARE_API_TOKEN --env production   # 5 でコピーしたトークンを貼り付ける
gh secret set CLOUDFLARE_ACCOUNT_ID --env production  # 6 のアカウント ID を貼り付ける
```

production の Environment は、`v*.*.*` のタグと main ブランチからしか使えないように設定しています。

### v0.2.0 から v0.3.0 に更新するとき

v0.3.0 で日記をユーザーごとに分けました。マイグレーションでテーブルを作り直し、既存の日記・会話ログ・メモはすべて id=1 のユーザーに割り当てます。次の順に進めてください。

1. [手順 9-5](#9-5-worker-に-access-の設定を登録する) の `ACCESS_TEAM_DOMAIN` と `ACCESS_AUD` を登録する（今のバージョンには影響しません）
2. 万一に備え、今の D1 に戻せる時点（bookmark）を控える。Time Travel は無料で、過去 7 日（Free プラン）まで戻せます

   ```sh
   npx wrangler d1 time-travel info kaitokune   # 表示された bookmark を控える
   ```

3. v0.3.0 をリリースする（マイグレーションの適用とデプロイ）
4. [手順 9-6](#9-6-ユーザーを登録する) で id=1 のメールアドレスを自分のものに書き換え、もう 1 人を登録する。書き換えるまでは、自分も 403 になります
5. 今までの日記が読めることを確かめる

日記が消えた・読めないなどの問題があれば、控えた bookmark に戻してから、前のバージョンをデプロイし直します。

```sh
npx wrangler d1 time-travel restore kaitokune --bookmark=<控えた bookmark>
```

### 手元からデプロイする

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

| 症状                                                                                                                  | 原因と対処                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` が `it's necessary to set a CLOUDFLARE_API_TOKEN` で止まる                                              | Cloudflare にログインしていません。`npx wrangler login` を実行するか、`npm run dev:local` を使ってください                                                                                                                          |
| `npm run dev` が `You need to register a workers.dev subdomain` / `Failed to start the remote proxy session` で止まる | workers.dev のサブドメインが未登録です。エラーに表示される URL か、[手順 4-2](#4-2-workersdev-のサブドメインを登録する初回のみ) の方法で登録してから、もう一度実行してください                                                      |
| 画面に「AI に接続できませんでした」と出る（API は 502）                                                               | すべての AI プロバイダが失敗しています。ターミナル（本番では `npx wrangler tail`）に `AI provider ... failed` と原因が出ます                                                                                                        |
| ログに `Binding AI needs to be run remotely` と出る                                                                   | `npm run dev:local` では Workers AI を使えません。Gemini のキーを設定するか、`npm run dev` を使ってください                                                                                                                         |
| ログに `workers-ai:... failed` と `internal error; reference = ...` が出る                                            | `WORKERS_AI_MODEL` のモデルが提供終了している可能性があります。`npx wrangler ai models list` で現在のモデルを確認し、`wrangler.jsonc` を変更してください（日本語に強い Gemma / Qwen 系がおすすめ）                                  |
| ログに `unexpected response` と出て、`content` が空で `reasoning` だけが入っている                                    | 推論（thinking）モデルが思考だけで出力上限を使い切っています。思考を無効にできないモデルの場合は、別のモデルに変更してください                                                                                                      |
| 「今日の AI 利用上限に達しました」と出る（API は 429）                                                                | 自分の `AI_DAILY_LIMIT`（1 人あたり）に達しました。`TIMEZONE` の日付が変わるとリセットされます                                                                                                                                      |
| 「ログインを確認できませんでした」と出る（API は 401）                                                                | 本番では `ACCESS_TEAM_DOMAIN` と `ACCESS_AUD` が未登録か間違っています（[手順 9-5](#9-5-worker-に-access-の設定を登録する)）。ローカルでは `.dev.vars` に `DEV_USER_EMAIL` がありません。原因はログに `access denied: ...` と出ます |
| 「〜 はまだ登録されていません」と出る（API は 403）                                                                   | Access は通りましたが、`users` テーブルにメールアドレスがありません。[手順 9-6](#9-6-ユーザーを登録する) で登録してください                                                                                                         |
| `npm run db:migrate:remote` やデプロイで `The database ... could not be found [code: 7404]` と出る                    | `wrangler.jsonc` の `DB` の `database_id` が実際のデータベースと一致していません。`npx wrangler d1 list` で ID を確認し、[手順 7](#7-本番用の-d1-データベースを作成する) のとおり置き換えてください                                 |
| `requires compatibility date "..."` で起動しない                                                                      | `wrangler.jsonc` の `compatibility_date` がローカルの実行環境より新しすぎます。表示された日付以前に下げてください                                                                                                                   |
| 本番で日記一覧などが空になる                                                                                          | ローカルと本番の D1 は別のデータベースです。ローカルで書いた日記は本番には反映されません                                                                                                                                            |
