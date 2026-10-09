# セキュリティポリシー

## 対象のバージョン

修正は最新の本番版（[Releases](https://github.com/ohiaeni/kaitokune/releases/latest) の Latest）にだけ入れます。古いバージョンへのバックポートはしません。

## 脆弱性の報告方法

脆弱性を見つけた場合は、**公開の issue・PR・Discussions には書かず**、GitHub の Private vulnerability reporting で報告してください。

1. リポジトリの [Security タブ](https://github.com/ohiaeni/kaitokune/security) を開く
2. 「Report a vulnerability」を押す
3. 再現手順・影響範囲・確認したバージョン（またはコミット）を書いて送る

報告の内容は、報告者とメンテナーだけが見られます。

## 報告を受けたあとの流れ

- 個人で開発しているため、返信までに数日かかることがあります
- 内容を確認し、修正が必要なら非公開のまま修正してリリースします
- 修正をリリースしたあと、必要に応じて GitHub Security Advisory として公開します

## 特に気をつけている点

kaitokune は日記というプライベートな情報を扱います。次のような問題は特に歓迎します。

- ほかのユーザーの日記・メモ・会話の記録を読み書きできる（ユーザーごとのデータの分離の不備）
- Cloudflare Access の JWT の検証を回避できる
- AI の 1 日の呼び出し上限（`AI_DAILY_LIMIT`）を回避して、無料枠を使い切らせられる
