import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  ApiErrorBody,
  Entry,
  EntryDetail,
  EntrySummary,
  NextResponse,
  QA,
  UsageResponse,
} from "../src/shared/schemas";
import type { DiaryAI } from "../src/worker/ai";
import { AllProvidersFailedError } from "../src/worker/ai/fallback";
import { createApp } from "../src/worker/app";
import type { Bindings } from "../src/worker/env";

type NextInput = Parameters<DiaryAI["nextQuestion"]>[0];

/** 呼び出し内容を記録するモックの AI */
function fakeAI(options: { done?: boolean; fail?: boolean } = {}) {
  const calls: { next: NextInput[]; compose: number } = { next: [], compose: 0 };
  const ai: DiaryAI = {
    async nextQuestion(input) {
      calls.next.push(input);
      if (options.fail) throw new AllProvidersFailedError([new Error("down")]);
      if (options.done && input.allowDone) return { done: true };
      return { question: `質問${input.qa.length + 1}` };
    },
    async composeDiary(input) {
      calls.compose++;
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
    expect(calls.compose).toBe(0);
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
    await env.DB.prepare("INSERT INTO ai_usage (date, count) VALUES ('2000-01-01', 1)").run();

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
