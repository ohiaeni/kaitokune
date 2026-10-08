import { beforeEach, describe, expect, it } from "vitest";
import type { ApiErrorBody, NextResponse } from "../../src/shared/schemas";
import { qa, resetDb, setup } from "../helpers";

beforeEach(resetDb);
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
