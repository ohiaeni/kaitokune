// npm run dev:mock で /api/* の代わりに応答するハンドラー。Worker（src/worker/routes/）の振る舞いを簡単にまねる。
// エクスポート（/api/export）はリンクのページ遷移で取得し、MSW では横取りできないのでモックしない
import { delay, HttpResponse, http } from "msw";
import {
  type ApiErrorBody,
  type ComposeResponse,
  type Entry,
  type EntryDetail,
  type EntrySummary,
  MAX_NOTES,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  type NextResponse,
  type Note,
  type QA,
  type SaveEntryRequest,
  type UsageResponse,
} from "../../shared/schemas";
import { today } from "../lib/date";
import { createStore } from "./data";
import type { Scenario } from "./scenarios";

/** wrangler.jsonc の AI_DAILY_LIMIT と合わせる */
const AI_DAILY_LIMIT = 25;
const EXCERPT_LENGTH = 80;
const LIST_LIMIT = 100;
const SEARCH_LIMIT = 50;

const QUESTIONS = [
  "今日はどんな一日でしたか？",
  "いちばん印象に残ったことは何ですか？",
  "そのとき、どんな気持ちでしたか？",
  "誰かと話したことで、心に残っていることはありますか？",
  "明日はどんなふうに過ごしたいですか？",
];

function errorResponse(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status });
}

function notFound(date: string) {
  return errorResponse(404, { error: "not_found", message: `${date} の日記はありません` });
}

function toSummary({ date, body, mood }: Entry): EntrySummary {
  return { date, excerpt: body.slice(0, EXCERPT_LENGTH), mood };
}

function toEntry({ qa: _, ...entry }: Entry & { qa: QA[] }): Entry {
  return entry;
}

export function createHandlers(scenario: Scenario) {
  const store = createStore(scenario);
  const sortedEntries = () => [...store.entries.values()].sort((a, b) => b.date.localeCompare(a.date));

  /** AI の呼び出しを 1 回数え、シナリオに応じて AI のエラーを返す */
  const consumeAi = () => {
    if (scenario === "ai-error") {
      return errorResponse(502, {
        error: "ai_unavailable",
        message: "AI に接続できませんでした。時間をおいて試してください",
      });
    }
    const date = today();
    const count = (store.aiUsage.get(date) ?? 0) + 1;
    store.aiUsage.set(date, count);
    if (scenario === "daily-limit" || count > AI_DAILY_LIMIT) {
      return errorResponse(429, {
        error: "daily_limit",
        message: `今日の AI 利用上限（${AI_DAILY_LIMIT} 回）に達しました`,
      });
    }
    return null;
  };

  return [
    // シナリオによって、すべての API を遅らせる・通信エラーにする
    http.all("/api/*", async () => {
      if (scenario === "slow") {
        await delay(2000);
      } else {
        await delay();
      }
      if (scenario === "offline") {
        return HttpResponse.error();
      }
    }),

    http.post<never, { date: string; qa: QA[] }>("/api/chat/next", async ({ request }) => {
      const { qa } = await request.json();
      if (qa.length >= MAX_QUESTIONS) {
        return HttpResponse.json<NextResponse>({ done: true });
      }
      const error = consumeAi();
      if (error) {
        return error;
      }
      // 最低限の質問数に答えたら、AI が会話を終えた場合の画面も確かめられるよう、1 問おきに終える
      if (qa.length >= MIN_QUESTIONS && qa.length % 2 === 0) {
        return HttpResponse.json<NextResponse>({ done: true });
      }
      return HttpResponse.json<NextResponse>({ question: QUESTIONS[qa.length] });
    }),

    http.post<never, { date: string; qa: QA[] }>("/api/chat/compose", async ({ request }) => {
      const { qa } = await request.json();
      const error = consumeAi();
      if (error) {
        return error;
      }
      return HttpResponse.json<ComposeResponse>({
        body: `（モックの日記）${qa.map((x) => x.answer).join("。")}。`,
        suggestions: ["朝に 10 分散歩する", "寝る前に今日よかったことを 1 つ思い出す"],
      });
    }),

    http.get("/api/entries", ({ request }) => {
      const params = new URL(request.url).searchParams;
      const q = params.get("q");
      const month = params.get("month");
      if (q) {
        const lower = q.toLowerCase();
        const hits = sortedEntries().filter(
          (e) =>
            e.body.toLowerCase().includes(lower) ||
            e.qa.some((x) => `${x.question}${x.answer}`.toLowerCase().includes(lower)),
        );
        return HttpResponse.json<EntrySummary[]>(hits.slice(0, SEARCH_LIMIT).map(toSummary));
      }
      const list = month ? sortedEntries().filter((e) => e.date.startsWith(`${month}-`)) : sortedEntries();
      return HttpResponse.json<EntrySummary[]>(list.slice(0, LIST_LIMIT).map(toSummary));
    }),

    http.get<{ date: string }>("/api/entries/:date", ({ params }) => {
      const entry = store.entries.get(params.date);
      if (!entry) {
        return notFound(params.date);
      }
      return HttpResponse.json<EntryDetail>({ entry: toEntry(entry), qa: entry.qa });
    }),

    http.put<{ date: string }, SaveEntryRequest>("/api/entries/:date", async ({ params, request }) => {
      const { body, mood = null, qa, suggestions } = await request.json();
      const existing = store.entries.get(params.date);
      const now = Date.now();
      const entry = {
        date: params.date,
        body,
        mood,
        suggestions: suggestions ?? existing?.suggestions ?? [],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        qa: qa ?? existing?.qa ?? [],
      };
      store.entries.set(params.date, entry);
      return HttpResponse.json<Entry>(toEntry(entry));
    }),

    http.patch<{ date: string }, { date: string }>("/api/entries/:date", async ({ params, request }) => {
      const { date: newDate } = await request.json();
      const entry = store.entries.get(params.date);
      if (newDate > today()) {
        return errorResponse(400, { error: "invalid_request", message: "未来の日付には変更できません" });
      }
      if (!entry) {
        return notFound(params.date);
      }
      if (newDate !== params.date && store.entries.has(newDate)) {
        return errorResponse(409, { error: "conflict", message: `${newDate} にはすでに日記があります` });
      }
      const moved = { ...entry, date: newDate, updatedAt: Date.now() };
      store.entries.delete(params.date);
      store.entries.set(newDate, moved);
      return HttpResponse.json<Entry>(toEntry(moved));
    }),

    http.delete<{ date: string }>("/api/entries/:date", ({ params }) => {
      store.entries.delete(params.date);
      return new HttpResponse(null, { status: 204 });
    }),

    http.get("/api/notes", ({ request }) => {
      const date = new URL(request.url).searchParams.get("date");
      return HttpResponse.json<Note[]>(store.notes.filter((n) => n.date === date));
    }),

    http.post<never, { date: string; body: string }>("/api/notes", async ({ request }) => {
      const { date, body } = await request.json();
      if (store.notes.filter((n) => n.date === date).length >= MAX_NOTES) {
        return errorResponse(400, { error: "invalid_request", message: `メモは 1 日 ${MAX_NOTES} 件までです` });
      }
      const note: Note = { id: store.nextNoteId++, date, body: body.trim(), createdAt: Date.now() };
      store.notes.push(note);
      return HttpResponse.json<Note>(note, { status: 201 });
    }),

    http.delete<{ id: string }>("/api/notes/:id", ({ params }) => {
      store.notes = store.notes.filter((n) => n.id !== Number(params.id));
      return new HttpResponse(null, { status: 204 });
    }),

    http.get("/api/usage", () => {
      const date = today();
      const used = scenario === "daily-limit" ? AI_DAILY_LIMIT : Math.min(store.aiUsage.get(date) ?? 0, AI_DAILY_LIMIT);
      const history = [...store.aiUsage].map(([d, count]) => ({ date: d, count: Math.min(count, AI_DAILY_LIMIT) }));
      return HttpResponse.json<UsageResponse>({
        ai: { date, today: { used, limit: AI_DAILY_LIMIT }, history },
        cloudflare: { status: "unconfigured" },
      });
    }),

    http.all("/api/*", () => errorResponse(404, { error: "not_found", message: "Not Found" })),
  ];
}
