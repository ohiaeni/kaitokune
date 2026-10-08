import { env } from "cloudflare:workers";
import type { QA } from "../src/shared/schemas";
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
    nextQuestion(input) {
      calls.next.push(input);
      if (options.fail) {
        return Promise.reject(new AllProvidersFailedError([new Error("down")]));
      }
      if (options.done && input.allowDone) {
        return Promise.resolve({ done: true });
      }
      return Promise.resolve({ question: `質問${input.qa.length + 1}` });
    },
    composeDiary(input) {
      calls.compose.push(input);
      if (options.fail) {
        return Promise.reject(new AllProvidersFailedError([new Error("down")]));
      }
      return Promise.resolve(`日記: ${input.qa.map((x) => x.answer).join("、")}`);
    },
  };
  return { ai, calls };
}

/** モックの AI でアプリを作り、リクエストを送る関数と AI の呼び出し記録を返す */
export function setup(
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

export const qa = (n: number): QA[] =>
  Array.from({ length: n }, (_, i) => ({ question: `質問${i + 1}`, answer: `回答${i + 1}` }));

/** ユーザーのデータを持つテーブルを空にする（各テストの beforeEach で呼ぶ） */
export async function resetDb() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM qa_logs"),
    env.DB.prepare("DELETE FROM entries"),
    env.DB.prepare("DELETE FROM ai_usage"),
    env.DB.prepare("DELETE FROM notes"),
  ]);
}

/** users テーブルにユーザーを登録する（登録済みなら何もしない） */
export async function registerUser(email: string) {
  await env.DB.prepare("INSERT OR IGNORE INTO users (email, created_at) VALUES (?, 0)").bind(email).run();
}
