import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { QA } from "../src/shared/schemas";
import { createDiaryAI, createGeneratorsFromEnv } from "../src/worker/ai";
import { createMockAI } from "../src/worker/ai/mock";
import type { Bindings } from "../src/worker/env";

function answers(n: number): QA[] {
  return Array.from({ length: n }, (_, i) => ({ question: `Q${i + 1}`, answer: `回答${i + 1}` }));
}

describe("createMockAI", () => {
  // 実際のプロンプトとパーサーを通して、モックの応答が受け付けられることを確かめる
  const ai = createDiaryAI([createMockAI()]);
  const input = { date: "2026-10-09", notes: [], recent: [] };

  it("asks questions until it is allowed to finish and runs out of them", async () => {
    expect(await ai.nextQuestion({ ...input, qa: [], allowDone: false })).toEqual({
      question: "今日はどんな一日でしたか？",
    });
    expect(await ai.nextQuestion({ ...input, qa: answers(3), allowDone: true })).toHaveProperty("question");
    expect(await ai.nextQuestion({ ...input, qa: answers(4), allowDone: true })).toEqual({ done: true });
    // 終わってはいけないときは、質問を使い切っても質問を返す
    expect(await ai.nextQuestion({ ...input, qa: answers(4), allowDone: false })).toHaveProperty("question");
  });

  it("composes a diary from the answers with suggestions", async () => {
    const result = await ai.composeDiary({ date: "2026-10-09", qa: answers(2), notes: [] });
    expect(result.body).toContain("回答1");
    expect(result.body).toContain("回答2");
    expect(result.suggestions).toHaveLength(2);
  });
});

describe("createGeneratorsFromEnv", () => {
  const names = (overrides: Partial<Bindings>) =>
    createGeneratorsFromEnv({ ...env, ...overrides } as Bindings).map((g) => g.name);

  it("uses only the mock when AI_MOCK is 1", () => {
    expect(names({ AI_MOCK: "1", GEMINI_API_KEY: "key" })).toEqual(["mock"]);
  });

  it("ignores AI_MOCK when Access is configured", () => {
    expect(names({ AI_MOCK: "1", ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com" })).not.toContain("mock");
    expect(names({ AI_MOCK: "1", ACCESS_AUD: "aud" })).not.toContain("mock");
  });

  it("uses Workers AI and then Gemini otherwise", () => {
    expect(names({ GEMINI_API_KEY: "key" })).toEqual([
      `workers-ai:${env.WORKERS_AI_MODEL}`,
      `gemini:${env.GEMINI_MODEL}`,
    ]);
  });
});
