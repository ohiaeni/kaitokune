import type { ComposeResponse, NextResponse, QA } from "../../shared/schemas";
import type { Bindings } from "../env";
import { generateWithFallback } from "./fallback";
import { createGemini } from "./gemini";
import { buildComposePrompt, buildNextQuestionPrompt, parseComposed, parseNextQuestion } from "./prompts";
import type { TextGenerator } from "./provider";
import { createWorkersAI } from "./workers-ai";

export interface DiaryAI {
  nextQuestion(input: {
    date: string;
    qa: QA[];
    /** その日のメモ */
    notes: string[];
    recent: string[];
    allowDone: boolean;
  }): Promise<NextResponse>;
  /** 日記の本文と、明日やってみることの提案を 1 回の呼び出しでまとめて作る */
  composeDiary(input: { date: string; qa: QA[]; notes: string[] }): Promise<ComposeResponse>;
}

export function createDiaryAI(generators: TextGenerator[]): DiaryAI {
  return {
    nextQuestion: (input) =>
      generateWithFallback(generators, buildNextQuestionPrompt(input), (text) =>
        parseNextQuestion(text, input.allowDone),
      ),
    composeDiary: (input) => generateWithFallback(generators, buildComposePrompt(input), parseComposed),
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
