import type { NextResponse, QA } from "../../shared/schemas";
import type { Bindings } from "../env";
import { generateWithFallback } from "./fallback";
import { createGemini } from "./gemini";
import { buildComposePrompt, buildNextQuestionPrompt, parseDiary, parseNextQuestion } from "./prompts";
import type { TextGenerator } from "./provider";
import { createWorkersAI } from "./workers-ai";

export interface DiaryAI {
  nextQuestion(input: { date: string; qa: QA[]; recent: string[]; allowDone: boolean }): Promise<NextResponse>;
  composeDiary(input: { date: string; qa: QA[] }): Promise<string>;
}

export function createDiaryAI(generators: TextGenerator[]): DiaryAI {
  return {
    nextQuestion: (input) =>
      generateWithFallback(generators, buildNextQuestionPrompt(input), (text) =>
        parseNextQuestion(text, input.allowDone),
      ),
    composeDiary: (input) => generateWithFallback(generators, buildComposePrompt(input), parseDiary),
  };
}

/** 環境変数から、メイン（Workers AI）→ 予備（Gemini）の順でプロバイダを組み立てる */
export function createGeneratorsFromEnv(env: Bindings): TextGenerator[] {
  const generators: TextGenerator[] = [createWorkersAI(env.AI, env.WORKERS_AI_MODEL)];
  if (env.GEMINI_API_KEY) {
    generators.push(createGemini(env.GEMINI_API_KEY, env.GEMINI_MODEL));
  }
  return generators;
}
