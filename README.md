# kaitokune

AI からの質問に答えるだけで、毎日の日記がかんたんに書けるアプリ。

> **絶対条件: 完全無料で運用できること**
> ホスティング・DB・認証・AI のすべてを、クレジットカード登録不要／従量課金なしの無料枠で構成する。

---

## コンセプト

1. アプリを開くと、AI が今日について 3〜5 問ほど質問してくる
   （例:「今日いちばん印象に残ったことは？」「それを聞いてどう感じましたか？」）
2. ユーザーは短く答えるだけ（テキスト入力。将来的に音声入力も可）
3. 回答をもとに AI が自然な文章の日記にまとめる
4. ユーザーが確認・編集して保存
5. 過去の日記をカレンダーや一覧で振り返れる

---

## 推奨構成（Cloudflare 無料枠で完結）

ホスティング・DB・AI を Cloudflare にまとめることで、1 つのアカウントで完全無料かつシンプルに運用できる。

```text
┌──────────────────────────────┐
│  ブラウザ / スマホ (PWA)       │
│  React + Vite + Tailwind CSS │
└──────────────┬───────────────┘
               │ HTTPS
┌──────────────▼───────────────────────────────┐
│  Cloudflare Workers (Hono)                    │
│   ├─ /api/auth/*   … Better Auth              │
│   ├─ /api/questions … 質問生成                 │
│   ├─ /api/compose   … 回答 → 日記本文を生成     │
│   └─ /api/entries   … 日記の CRUD              │
└───────┬─────────────────────────┬────────────┘
        │                         │
┌───────▼────────┐      ┌─────────▼──────────────────┐
│ Cloudflare D1  │      │ AI                          │
│ (SQLite)       │      │  メイン: Workers AI          │
│ Drizzle ORM    │      │  予備  : Gemini API 無料枠    │
└────────────────┘      └────────────────────────────┘
```

### 技術スタック

| レイヤー | 採用技術 | 無料である理由 / 選定理由 |
| --- | --- | --- |
| フロントエンド | React 19 + Vite + TypeScript | OSS。軽量で開発体験が良い |
| UI | Tailwind CSS + shadcn/ui | OSS。チャット風 UI を素早く作れる |
| ルーティング | TanStack Router | 型安全なルーティング |
| PWA | vite-plugin-pwa | スマホのホーム画面に追加してネイティブアプリ風に使える（App Store 登録費不要） |
| API | Hono on Cloudflare Workers | Workers 無料枠（1 日 10 万リクエスト程度）で個人利用には十分 |
| 静的ホスティング | Cloudflare Workers Static Assets | 無料・帯域無制限 |
| DB | Cloudflare D1 + Drizzle ORM | D1 無料枠（数 GB のストレージ）。テキスト日記なら事実上使い切れない |
| 認証 | Better Auth（D1 に保存） | OSS のセルフホスト型で外部の有料認証サービス不要。Google / GitHub ログインも無料 |
| AI（メイン） | Cloudflare Workers AI | 1 日あたりの無料枠（Neurons）あり。Llama / Gemma / Qwen 系などのオープンモデルを Workers から直接呼べ、API キー管理も不要 |
| AI（予備） | Google Gemini API 無料枠（Flash 系モデル） | 日本語品質が高い。Workers AI の無料枠を超えた場合のフォールバック先 |
| 音声入力（任意） | Web Speech API | ブラウザ標準機能なので無料 |
| CI/CD | GitHub Actions + Wrangler | パブリック／個人リポジトリの無料枠でデプロイ自動化 |

---

## AI サービスの比較（すべて無料で使えるもの）

| サービス | 無料の形態 | 日本語品質 | 長所 | 注意点 |
| --- | --- | --- | --- | --- |
| **Cloudflare Workers AI** | 1 日ごとの無料枠 | ○ | インフラと統合、キー不要、カード登録不要 | 無料枠超過分は課金対象になるため、上限チェックを実装する（後述） |
| **Google Gemini API** | 無料ティア（レート制限あり） | ◎ | 日本語が自然、高性能 | 無料ティアでは入力データが Google の品質改善に使われる可能性がある |
| **Groq** | 無料ティア（レート制限あり） | ○ | 非常に高速 | モデルの入れ替わりが早い |
| **OpenRouter（`:free` モデル）** | 無料モデル枠 | △〜○ | 多数のモデルを 1 つの API で試せる | 1 日のリクエスト数制限が厳しめ |
| **ブラウザ内 AI（WebLLM / Chrome Built-in AI）** | 完全ローカル | △ | サーバー不要、データが端末外に出ない | 端末性能に依存、初回のモデルダウンロードが重い |

**方針:** Workers AI をメインにし、`AIProvider` インターフェースで抽象化して Gemini / Groq などへ簡単に切り替えられるようにする。

```ts
interface AIProvider {
  generateQuestions(context: DiaryContext): Promise<string[]>;
  composeDiary(qa: { question: string; answer: string }[]): Promise<string>;
}
```

### 「完全無料」を守るためのガード

- **カードを登録しない**: Cloudflare・Google AI Studio ともにカード未登録のまま無料枠だけを使う。カード未登録なら超過しても課金されず、エラーになるだけ。
- **アプリ側の利用上限**: 1 ユーザーあたり 1 日の AI 呼び出し回数を D1 で数え、上限を超えたら停止する。
- **フォールバック**: メインの AI がレート制限（HTTP 429）になったら予備のプロバイダに切り替える。
- **トークン節約**: 質問生成は 1 リクエストでまとめて 3〜5 問を返させ、日記の生成も 1 回で済ませる。

---

## 代替構成

### A. ローカルファースト構成（サーバー 0・完全プライベート）

- React + Vite の PWA を GitHub Pages / Cloudflare Pages で静的配信
- データは IndexedDB（Dexie.js）に端末内保存
- AI は WebLLM（小型モデル）または Chrome Built-in AI をブラウザ内で実行
- **長所:** 運用コストがゼロで、レート制限もない。日記が外部に送信されない
- **短所:** 端末間で同期できない。古いスマホでは動作が重い。日本語の文章品質は下がる

### B. Next.js + Supabase 構成

- Next.js（Vercel Hobby）+ Supabase（Postgres / Auth）+ Gemini API
- **長所:** 情報が多く、認証が簡単
- **短所:** Vercel Hobby は非商用利用に限られる。Supabase の無料プロジェクトは一定期間アクセスがないと一時停止される

→ 個人利用でクラウド同期もしたい場合は **推奨構成（Cloudflare）**、プライバシーを最優先する場合は **A** を選ぶ。

---

## データモデル（案）

```sql
-- users / sessions は Better Auth が管理

CREATE TABLE entries (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,          -- YYYY-MM-DD
  body        TEXT NOT NULL,          -- AI が生成し、ユーザーが編集した日記本文
  mood        INTEGER,                -- 1〜5（任意）
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (user_id, date)
);

CREATE TABLE qa_logs (
  id          TEXT PRIMARY KEY,
  entry_id    TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL
);

CREATE TABLE ai_usage (
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
```

---

## ディレクトリ構成（案）

```text
kaitokune/
├── apps/
│   ├── web/            # React + Vite (PWA)
│   └── api/            # Hono on Cloudflare Workers
├── packages/
│   ├── db/             # Drizzle スキーマ & マイグレーション
│   ├── ai/             # AIProvider 実装 (workers-ai / gemini / groq)
│   └── shared/         # 型定義・バリデーション (Zod)
├── pnpm-workspace.yaml
└── README.md
```

- パッケージ管理: pnpm workspaces
- Lint / Format: Biome
- テスト: Vitest

---

## 開発ロードマップ

1. **MVP**: 質問 → 回答 → 日記生成 → 保存（ログインなし、1 ユーザー）
2. 認証を追加（Better Auth）、日記の一覧とカレンダー表示
3. 過去の日記を踏まえた質問のパーソナライズ（直近数日の要約をプロンプトに含める）
4. PWA 化、毎日のリマインド通知（Web Push は無料）
5. 音声入力、気分グラフ、週や月ごとの振り返りを AI がまとめる機能

---

## 注意事項

- 各サービスの無料枠の内容（回数・容量・対象モデル）は頻繁に変わるため、実装前に必ず公式の料金ページを確認すること。
- 日記はプライベートな情報のため、無料の AI API に送る内容とプライバシーポリシー（学習に利用されるかどうか）をユーザーに明示すること。
