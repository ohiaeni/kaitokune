import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { ApiErrorBody, Entry, EntryDetail, EntrySummary, NextResponse, QA } from "../src/shared/schemas";
import type { DiaryAI } from "../src/worker/ai";
import { AllProvidersFailedError } from "../src/worker/ai/fallback";
import { createApp } from "../src/worker/app";

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

function setup(options: Parameters<typeof fakeAI>[0] = {}, envOverrides: Partial<typeof env> = {}) {
  const { ai, calls } = fakeAI(options);
  const app = createApp({ createAI: () => ai });
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

  it("rejects an invalid date or mood", async () => {
    const { request } = setup();
    expect((await request("/api/entries/not-a-date")).status).toBe(400);
    const res = await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文", mood: 9 } });
    expect(res.status).toBe(400);
  });
});
