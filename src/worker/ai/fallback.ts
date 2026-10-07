import type { Prompt, TextGenerator } from "./provider";

export class AllProvidersFailedError extends Error {
  constructor(readonly causes: unknown[]) {
    super(`all AI providers failed: ${causes.map((c) => (c instanceof Error ? c.message : String(c))).join(" / ")}`);
    this.name = "AllProvidersFailedError";
  }
}

/**
 * プロバイダを順番に試し、最初に「生成とパースの両方」に成功した結果を返す。
 * レート制限（429）・サーバーエラー・不正なモデル名・出力形式の崩れのどれでも、次のプロバイダへ切り替える。
 */
export async function generateWithFallback<T>(
  generators: TextGenerator[],
  prompt: Prompt,
  parse: (text: string) => T,
): Promise<T> {
  const causes: unknown[] = [];
  for (const gen of generators) {
    try {
      return parse(await gen.generate(prompt));
    } catch (e) {
      console.warn(`AI provider ${gen.name} failed`, e);
      causes.push(e);
    }
  }
  throw new AllProvidersFailedError(causes);
}
