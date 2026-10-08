import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  ApiErrorBody,
  Entry,
  EntryDetail,
  EntrySummary,
  ExportFile,
  NextResponse,
  Note,
  QA,
  UsageResponse,
} from "../src/shared/schemas";
import type { DiaryAI } from "../src/worker/ai";
import { AllProvidersFailedError } from "../src/worker/ai/fallback";
import { createApp } from "../src/worker/app";
import type { Bindings } from "../src/worker/env";

type NextInput = Parameters<DiaryAI["nextQuestion"]>[0];
type ComposeInput = Parameters<DiaryAI["composeDiary"]>[0];

/** 呼び出し内容を記録するモックの AI */
function fakeAI(options: { done?: boolean; fail?: boolean } = {}) {
  const calls: { next: NextInput[]; compose: ComposeInput[] } = { next: [], compose: [] };
  const ai: DiaryAI = {
    async nextQuestion(input) {
      calls.next.push(input);
      if (options.fail) throw new AllProvidersFailedError([new Error("down")]);
      if (options.done && input.allowDone) return { done: true };
      return { question: `質問${input.qa.length + 1}` };
    },
    async composeDiary(input) {
      calls.compose.push(input);
      if (options.fail) throw new AllProvidersFailedError([new Error("down")]);
      return `日記: ${input.qa.map((x) => x.answer).join("、")}`;
    },
  };
  return { ai, calls };
}

function setup(
  options: Parameters<typeof fakeAI>[0] = {},
  envOverrides: Partial<Bindings> = {},
  fetcher?: typeof fetch,
) {
  const { ai, calls } = fakeAI(options);
  const app = createApp({ createAI: () => ai, fetcher });
  const testEnv = { ...env, ...envOverrides };
  const request = (path: string, init?: { method?: string; json?: unknown }) =>
    app.request(
      path,
      {
        method: init?.method ?? "GET",
        headers: init?.json ? { "content-type": "application/json" } : undefined,
        body: init?.json ? JSON.stringify(init.json) : undefined,
      },
      testEnv,
    );
  return { request, calls };
}

const qa = (n: number): QA[] =>
  Array.from({ length: n }, (_, i) => ({ question: `質問${i + 1}`, answer: `回答${i + 1}` }));

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM qa_logs"),
    env.DB.prepare("DELETE FROM entries"),
    env.DB.prepare("DELETE FROM ai_usage"),
    env.DB.prepare("DELETE FROM notes"),
  ]);
});

describe("POST /api/chat/next", () => {
  it("returns the first question and passes recent entries as context", async () => {
    const { request, calls } = setup();
    await request("/api/entries/2026-10-06", { method: "PUT", json: { body: "昨日は散歩した" } });
    await request("/api/entries/2026-10-09", { method: "PUT", json: { body: "未来の日記は含めない" } });

    const res = await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: [] } });
    expect(res.status).toBe(200);
    expect(await res.json<NextResponse>()).toEqual({ question: "質問1" });
    expect(calls.next[0].recent).toEqual(["2026-10-06: 昨日は散歩した"]);
    expect(calls.next[0].allowDone).toBe(false);
  });

  it("allows the AI to finish only after the minimum number of answers", async () => {
    const { request, calls } = setup({ done: true });
    const early = await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: qa(2) } });
    expect(await early.json<NextResponse>()).toEqual({ question: "質問3" });

    const enough = await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: qa(3) } });
    expect(await enough.json<NextResponse>()).toEqual({ done: true });
    expect(calls.next.map((c) => c.allowDone)).toEqual([false, true]);
    expect(calls.next.every((c) => c.recent.length === 0)).toBe(true);
  });

  it("ends the conversation at the maximum without calling the AI", async () => {
    const { request, calls } = setup();
    const res = await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: qa(5) } });
    expect(await res.json<NextResponse>()).toEqual({ done: true });
    expect(calls.next).toHaveLength(0);
  });

  it("rejects invalid input with 400", async () => {
    const { request } = setup();
    const res = await request("/api/chat/next", { method: "POST", json: { date: "2026/10/08", qa: [] } });
    expect(res.status).toBe(400);
    expect((await res.json<ApiErrorBody>()).error).toBe("invalid_request");

    const tooMany = await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: qa(6) } });
    expect(tooMany.status).toBe(400);
  });

  it("returns 429 after the daily AI limit is reached", async () => {
    const { request, calls } = setup({}, { AI_DAILY_LIMIT: "2" });
    const send = () => request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: [] } });
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    const limited = await send();
    expect(limited.status).toBe(429);
    expect((await limited.json<ApiErrorBody>()).error).toBe("daily_limit");
    expect(calls.next).toHaveLength(2);
  });

  it("returns 502 when every AI provider fails", async () => {
    const { request } = setup({ fail: true });
    const res = await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: [] } });
    expect(res.status).toBe(502);
    expect((await res.json<ApiErrorBody>()).error).toBe("ai_unavailable");
  });
});

describe("POST /api/chat/compose", () => {
  it("returns the composed diary", async () => {
    const { request } = setup();
    const res = await request("/api/chat/compose", { method: "POST", json: { date: "2026-10-08", qa: qa(2) } });
    expect(await res.json()).toEqual({ body: "日記: 回答1、回答2" });
  });

  it("requires at least one answer", async () => {
    const { request, calls } = setup();
    const res = await request("/api/chat/compose", { method: "POST", json: { date: "2026-10-08", qa: [] } });
    expect(res.status).toBe(400);
    expect(calls.compose).toHaveLength(0);
  });
});

describe("/api/notes", () => {
  const addNote = (request: ReturnType<typeof setup>["request"], date: string, body: string) =>
    request("/api/notes", { method: "POST", json: { date, body } });

  it("adds, lists and deletes the notes of a day", async () => {
    const { request } = setup();
    const created = await addNote(request, "2026-10-08", "  昼にラーメン  ");
    expect(created.status).toBe(201);
    const note = await created.json<Note>();
    expect(note).toMatchObject({ date: "2026-10-08", body: "昼にラーメン" });
    await addNote(request, "2026-10-08", "夕方に雨");
    await addNote(request, "2026-10-07", "別の日");

    const list = async () => (await (await request("/api/notes?date=2026-10-08")).json<Note[]>()).map((n) => n.body);
    expect(await list()).toEqual(["昼にラーメン", "夕方に雨"]);

    expect((await request(`/api/notes/${note.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await list()).toEqual(["夕方に雨"]);
  });

  it("limits the number and length of notes", async () => {
    const { request } = setup();
    expect((await addNote(request, "2026-10-08", "あ".repeat(201))).status).toBe(400);
    expect((await addNote(request, "2026-10-08", "   ")).status).toBe(400);
    for (let i = 0; i < 20; i++) expect((await addNote(request, "2026-10-08", `メモ${i}`)).status).toBe(201);
    const over = await addNote(request, "2026-10-08", "21 件目");
    expect(over.status).toBe(400);
    expect((await over.json<ApiErrorBody>()).message).toContain("20 件");
    expect((await addNote(request, "2026-10-09", "別の日は追加できる")).status).toBe(201);
  });

  it("passes the day's notes to the AI when asking and composing", async () => {
    const { request, calls } = setup();
    await addNote(request, "2026-10-08", "昼にラーメン");
    await addNote(request, "2026-10-07", "別の日");

    await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: qa(1) } });
    await request("/api/chat/compose", { method: "POST", json: { date: "2026-10-08", qa: qa(1) } });
    expect(calls.next[0].notes).toEqual(["昼にラーメン"]);
    expect(calls.compose[0].notes).toEqual(["昼にラーメン"]);
  });
});

describe("/api/entries", () => {
  it("saves an entry with its conversation and reads it back", async () => {
    const { request } = setup();
    const put = await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文", mood: 4, qa: qa(3) } });
    expect(put.status).toBe(200);
    expect((await put.json<Entry>()).mood).toBe(4);

    const detail = await (await request("/api/entries/2026-10-08")).json<EntryDetail>();
    expect(detail.entry.body).toBe("本文");
    expect(detail.qa).toEqual(qa(3));
  });

  it("keeps the conversation log when only the body is edited", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文", qa: qa(3) } });
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "書き直した本文", mood: 2 } });

    const detail = await (await request("/api/entries/2026-10-08")).json<EntryDetail>();
    expect(detail.entry.body).toBe("書き直した本文");
    expect(detail.entry.mood).toBe(2);
    expect(detail.entry.createdAt).toBeLessThanOrEqual(detail.entry.updatedAt);
    expect(detail.qa).toHaveLength(3);
  });

  it("lists entries for a month, newest first", async () => {
    const { request } = setup();
    for (const date of ["2026-09-30", "2026-10-01", "2026-10-15"]) {
      await request(`/api/entries/${date}`, { method: "PUT", json: { body: `${date} の日記` } });
    }
    const list = await (await request("/api/entries?month=2026-10")).json<EntrySummary[]>();
    expect(list.map((e) => e.date)).toEqual(["2026-10-15", "2026-10-01"]);
    expect(list[0].excerpt).toBe("2026-10-15 の日記");
  });

  it("searches entries by keyword in the body and the conversation, newest first", async () => {
    const { request } = setup();
    const long = `${"あ".repeat(40)}カフェに行った${"い".repeat(100)}`;
    await request("/api/entries/2026-09-01", { method: "PUT", json: { body: long } });
    await request("/api/entries/2026-10-01", {
      method: "PUT",
      json: { body: "家で過ごした", qa: [{ question: "どこへ？", answer: "駅前のカフェ" }] },
    });
    await request("/api/entries/2026-10-02", { method: "PUT", json: { body: "関係ない日" } });
    const search = async (q: string) =>
      (await request(`/api/entries?q=${encodeURIComponent(q)}`)).json<EntrySummary[]>();

    const results = await search("カフェ");
    expect(results.map((e) => e.date)).toEqual(["2026-10-01", "2026-09-01"]);
    // 本文に一致しなければ問答から、本文が長ければ一致した箇所の前後を抜粋する
    expect(results[0].excerpt).toBe("駅前のカフェ");
    expect(results[1].excerpt).toBe(`…${"あ".repeat(20)}カフェに行った${"い".repeat(53)}…`);

    expect(await search("見つからない")).toEqual([]);
  });

  it("treats LIKE wildcards in the keyword literally", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-01", { method: "PUT", json: { body: "達成率は 100% だった" } });
    await request("/api/entries/2026-10-02", { method: "PUT", json: { body: "snake_case と書いた" } });
    await request("/api/entries/2026-10-03", { method: "PUT", json: { body: "10 回 snakeXcase" } });
    const search = async (q: string) =>
      (await (await request(`/api/entries?q=${encodeURIComponent(q)}`)).json<EntrySummary[]>()).map((e) => e.date);

    expect(await search("%")).toEqual(["2026-10-01"]);
    expect(await search("e_c")).toEqual(["2026-10-02"]);
    expect(await search("\\")).toEqual([]);
  });

  it("rejects an empty or too long keyword", async () => {
    const { request } = setup();
    expect((await request("/api/entries?q=")).status).toBe(400);
    expect((await request(`/api/entries?q=${"a".repeat(51)}`)).status).toBe(400);
  });

  it("deletes an entry and its conversation", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文", qa: qa(2) } });
    expect((await request("/api/entries/2026-10-08", { method: "DELETE" })).status).toBe(204);
    expect((await request("/api/entries/2026-10-08")).status).toBe(404);
    const { count } = (await env.DB.prepare("SELECT COUNT(*) AS count FROM qa_logs").first<{ count: number }>()) ?? {};
    expect(count).toBe(0);
  });

  it("changes the date of an entry together with its conversation", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文", mood: 3, qa: qa(2) } });

    const res = await request("/api/entries/2026-10-08", { method: "PATCH", json: { date: "2026-10-07" } });
    expect(res.status).toBe(200);
    expect(await res.json<Entry>()).toMatchObject({ date: "2026-10-07", body: "本文", mood: 3 });

    expect((await request("/api/entries/2026-10-08")).status).toBe(404);
    const detail = await (await request("/api/entries/2026-10-07")).json<EntryDetail>();
    expect(detail.entry.body).toBe("本文");
    expect(detail.qa).toEqual(qa(2));
  });

  it("refuses to change the date onto an existing entry, a future date, or a missing entry", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-07", { method: "PUT", json: { body: "前日", qa: qa(1) } });
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "当日" } });
    const patch = (from: string, to: string) =>
      request(`/api/entries/${from}`, { method: "PATCH", json: { date: to } });

    const conflict = await patch("2026-10-08", "2026-10-07");
    expect(conflict.status).toBe(409);
    expect((await conflict.json<ApiErrorBody>()).error).toBe("conflict");
    const kept = await (await request("/api/entries/2026-10-07")).json<EntryDetail>();
    expect(kept.entry.body).toBe("前日");
    expect(kept.qa).toEqual(qa(1));

    expect((await patch("2026-10-08", "2999-01-01")).status).toBe(400);
    expect((await patch("2026-10-01", "2026-09-30")).status).toBe(404);
    expect((await patch("2026-10-08", "2026/10/06")).status).toBe(400);
  });

  it("rejects an invalid date or mood", async () => {
    const { request } = setup();
    expect((await request("/api/entries/not-a-date")).status).toBe(400);
    const res = await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文", mood: 9 } });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/export", () => {
  it("exports every entry with its conversation as JSON", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "二日目", mood: 5, qa: qa(2) } });
    await request("/api/entries/2026-10-07", { method: "PUT", json: { body: "一日目" } });

    const res = await request("/api/export?format=json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="kaitokune-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    const file = await res.json<ExportFile>();
    expect(file).toMatchObject({ format: "kaitokune", version: 1 });
    expect(file.entries.map((e) => [e.date, e.body, e.mood, e.qa])).toEqual([
      ["2026-10-07", "一日目", null, []],
      ["2026-10-08", "二日目", 5, qa(2)],
    ]);
    expect(file.entries[0].createdAt).toEqual(expect.any(Number));
  });

  it("exports a readable Markdown file", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文です", mood: 4, qa: qa(1) } });

    const res = await request("/api/export?format=markdown");
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(/\.md"$/);
    const text = await res.text();
    expect(text).toContain("（1 件）");
    expect(text).toContain("## 2026年10月8日（木）\n\n気分: 🙂 よい\n\n本文です\n\n<details>");
    expect(text).toContain("**Q. 質問1**\n\nA. 回答1");
  });

  it("rejects an unknown format", async () => {
    const { request } = setup();
    expect((await request("/api/export?format=csv")).status).toBe(400);
  });
});

describe("GET /api/usage", () => {
  const analyticsEnv = { CF_ANALYTICS_TOKEN: "token", CF_ACCOUNT_ID: "account" };

  /** GraphQL Analytics API のモック。受け取ったリクエストを記録する */
  function fakeAnalytics(response: Response | (() => never)) {
    const requests: Request[] = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return typeof response === "function" ? response() : response;
    }) as typeof fetch;
    return { fetcher, requests };
  }

  const analyticsData = {
    data: {
      viewer: {
        accounts: [
          {
            workersInvocationsAdaptive: [{ sum: { requests: 1234 } }],
            aiInferenceAdaptiveGroups: [{ sum: { totalNeurons: 56.5 } }],
            d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 789, rowsWritten: 12 } }],
            d1StorageAdaptiveGroups: [
              { dimensions: { databaseId: "a" }, max: { databaseSizeBytes: 3000 } },
              { dimensions: { databaseId: "b" }, max: { databaseSizeBytes: 500 } },
              { dimensions: { databaseId: "a" }, max: { databaseSizeBytes: 1000 } },
            ],
          },
        ],
      },
    },
    errors: null,
  };

  it("returns today's AI calls (capped at the limit) and skips Cloudflare when unconfigured", async () => {
    const { fetcher, requests } = fakeAnalytics(Response.json(analyticsData));
    const { request } = setup({}, { AI_DAILY_LIMIT: "2" }, fetcher);
    await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: [] } });
    await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: [] } });
    await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: [] } });
    await env.DB.prepare("INSERT INTO ai_usage (user_id, date, count) VALUES (1, '2000-01-01', 1)").run();

    const body = await (await request("/api/usage")).json<UsageResponse>();
    expect(body.ai.today).toEqual({ used: 2, limit: 2 });
    expect(body.ai.history.map((h) => h.count)).toEqual([2, 1]);
    expect(body.ai.history[0].date).toBe(body.ai.date);
    expect(body.cloudflare).toEqual({ status: "unconfigured" });
    expect(requests).toHaveLength(0);
  });

  it("summarizes the account's free-tier usage from the GraphQL Analytics API", async () => {
    const { fetcher, requests } = fakeAnalytics(Response.json(analyticsData));
    const { request } = setup({}, analyticsEnv, fetcher);

    const { cloudflare } = await (await request("/api/usage")).json<UsageResponse>();
    expect(cloudflare).toMatchObject({
      status: "ok",
      workersRequests: { used: 1234, limit: 100_000 },
      workersAiNeurons: { used: 56.5, limit: 10_000 },
      d1RowsRead: { used: 789, limit: 5_000_000 },
      d1RowsWritten: { used: 12, limit: 100_000 },
      // データベースごとに最新（先頭）の値だけを合計する
      d1StorageBytes: { used: 3500, limit: 5_000_000_000 },
    });
    expect(requests[0].headers.get("authorization")).toBe("Bearer token");
    const { variables } = await requests[0].json<{ variables: { accountTag: string } }>();
    expect(variables.accountTag).toBe("account");
  });

  it("treats missing rows as zero usage", async () => {
    const empty = {
      data: {
        viewer: {
          accounts: [
            {
              workersInvocationsAdaptive: [],
              aiInferenceAdaptiveGroups: [],
              d1AnalyticsAdaptiveGroups: [],
              d1StorageAdaptiveGroups: [],
            },
          ],
        },
      },
    };
    const { request } = setup({}, analyticsEnv, fakeAnalytics(Response.json(empty)).fetcher);
    const { cloudflare } = await (await request("/api/usage")).json<UsageResponse>();
    expect(cloudflare).toMatchObject({ status: "ok", workersAiNeurons: { used: 0 }, d1StorageBytes: { used: 0 } });
  });

  it("reports Cloudflare errors without failing the whole response", async () => {
    const cases: [Response | (() => never), string][] = [
      [new Response("forbidden", { status: 403 }), "HTTP 403"],
      [Response.json({ data: null, errors: [{ message: "not authorized" }] }), "not authorized"],
      [
        () => {
          throw new Error("network down");
        },
        "接続できませんでした",
      ],
    ];
    for (const [response, message] of cases) {
      const { request } = setup({}, analyticsEnv, fakeAnalytics(response).fetcher);
      const res = await request("/api/usage");
      expect(res.status).toBe(200);
      const { cloudflare } = await res.json<UsageResponse>();
      expect(cloudflare.status).toBe("error");
      expect(cloudflare.status === "error" && cloudflare.message).toContain(message);
    }
  });
});

describe("user isolation", () => {
  const OTHER = "other@example.invalid";

  beforeEach(async () => {
    await env.DB.prepare("INSERT OR IGNORE INTO users (email, created_at) VALUES (?, 0)").bind(OTHER).run();
  });

  /** 自分（id=1）が日記・会話ログ・メモを持っている状態にする */
  async function seedOwner() {
    const owner = setup();
    await owner.request("/api/entries/2026-10-07", { method: "PUT", json: { body: "自分の秘密の日記", qa: qa(2) } });
    const note = await (
      await owner.request("/api/notes", { method: "POST", json: { date: "2026-10-08", body: "自分のメモ" } })
    ).json<Note>();
    return { owner, note };
  }

  it("does not show other users' entries, search results, notes or exports", async () => {
    await seedOwner();
    const other = setup({}, { DEV_USER_EMAIL: OTHER });

    expect(await (await other.request("/api/entries")).json()).toEqual([]);
    expect(await (await other.request("/api/entries?month=2026-10")).json()).toEqual([]);
    expect(await (await other.request("/api/entries?q=秘密")).json()).toEqual([]);
    expect(await (await other.request("/api/entries?q=回答1")).json()).toEqual([]);
    expect((await other.request("/api/entries/2026-10-07")).status).toBe(404);
    expect(await (await other.request("/api/notes?date=2026-10-08")).json()).toEqual([]);
    expect((await (await other.request("/api/export?format=json")).json<ExportFile>()).entries).toEqual([]);
    expect(await (await other.request("/api/export?format=markdown")).text()).not.toContain("秘密");
  });

  it("does not let other users change or delete someone else's data", async () => {
    const { owner, note } = await seedOwner();
    const other = setup({}, { DEV_USER_EMAIL: OTHER });

    const patch = await other.request("/api/entries/2026-10-07", { method: "PATCH", json: { date: "2026-10-01" } });
    expect(patch.status).toBe(404);
    expect((await other.request("/api/entries/2026-10-07", { method: "DELETE" })).status).toBe(204);
    expect((await other.request(`/api/notes/${note.id}`, { method: "DELETE" })).status).toBe(204);

    const detail = await (await owner.request("/api/entries/2026-10-07")).json<EntryDetail>();
    expect(detail.entry.body).toBe("自分の秘密の日記");
    expect(detail.qa).toEqual(qa(2));
    expect(await (await owner.request("/api/notes?date=2026-10-08")).json<Note[]>()).toHaveLength(1);
  });

  it("lets each user keep their own entry for the same date", async () => {
    const { owner } = await seedOwner();
    const other = setup({}, { DEV_USER_EMAIL: OTHER });

    const res = await other.request("/api/entries/2026-10-07", {
      method: "PUT",
      json: { body: "相手の日記", qa: qa(1) },
    });
    expect(res.status).toBe(200);
    // 日付の変更での重複チェックもユーザーごと
    await other.request("/api/entries/2026-10-05", { method: "PUT", json: { body: "相手の別の日記" } });
    const moved = await other.request("/api/entries/2026-10-05", { method: "PATCH", json: { date: "2026-10-03" } });
    expect(moved.status).toBe(200);

    expect((await (await owner.request("/api/entries/2026-10-07")).json<EntryDetail>()).entry.body).toBe(
      "自分の秘密の日記",
    );
    const theirs = await (await other.request("/api/entries/2026-10-07")).json<EntryDetail>();
    expect(theirs).toEqual({ entry: expect.objectContaining({ body: "相手の日記" }), qa: qa(1) });
    expect((await (await owner.request("/api/entries")).json<EntrySummary[]>()).map((e) => e.date)).toEqual([
      "2026-10-07",
    ]);

    // 自分が日記を消しても、相手の同じ日付の日記と会話ログは残る
    await owner.request("/api/entries/2026-10-07", { method: "DELETE" });
    expect(await (await other.request("/api/entries/2026-10-07")).json<EntryDetail>()).toEqual(theirs);
  });

  it("does not pass other users' entries or notes to the AI", async () => {
    await seedOwner();
    const other = setup({}, { DEV_USER_EMAIL: OTHER });

    await other.request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: [] } });
    await other.request("/api/chat/compose", { method: "POST", json: { date: "2026-10-08", qa: qa(1) } });
    expect(other.calls.next[0]).toMatchObject({ recent: [], notes: [] });
    expect(other.calls.compose[0]).toMatchObject({ notes: [] });
  });

  it("counts the daily AI limit per user", async () => {
    const owner = setup({}, { AI_DAILY_LIMIT: "1" });
    const other = setup({}, { AI_DAILY_LIMIT: "1", DEV_USER_EMAIL: OTHER });
    const next = (user: typeof owner) =>
      user.request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: [] } });

    expect((await next(owner)).status).toBe(200);
    expect((await next(owner)).status).toBe(429);
    // 自分が上限に達しても、相手はまだ使える
    expect((await next(other)).status).toBe(200);
    expect((await next(other)).status).toBe(429);

    const usage = await (await other.request("/api/usage")).json<UsageResponse>();
    expect(usage.ai.today).toEqual({ used: 1, limit: 1 });
    expect(usage.ai.history).toHaveLength(1);
  });

  it("does not include the user id in responses", async () => {
    const { owner, note } = await seedOwner();
    const detail = await (await owner.request("/api/entries/2026-10-07")).json<EntryDetail>();
    const saved = await (await owner.request("/api/entries/2026-10-07", { method: "PUT", json: { body: "x" } })).json();
    const file = await (await owner.request("/api/export?format=json")).json<ExportFile>();
    for (const value of [detail.entry, saved, file.entries[0], note]) {
      expect(Object.keys(value as object)).not.toContain("userId");
    }
  });
});
