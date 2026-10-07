import { type Prompt, ProviderError, type TextGenerator } from "./provider";

/** Cloudflare Workers AI（無料枠: 1 日あたりの Neurons 上限まで） */
export function createWorkersAI(ai: Ai, model: string): TextGenerator {
  const name = `workers-ai:${model}`;
  return {
    name,
    async generate(prompt: Prompt) {
      let result: unknown;
      try {
        // モデル名は vars で切り替えるため、型上は任意のモデルとして扱う
        result = await ai.run(
          model as keyof AiModels,
          {
            messages: [
              { role: "system", content: prompt.system },
              { role: "user", content: prompt.user },
            ],
            max_tokens: 1024,
            temperature: 0.7,
          } as never,
        );
      } catch (e) {
        throw new ProviderError(name, e instanceof Error ? e.message : String(e));
      }

      const response = (result as { response?: unknown } | null)?.response;
      if (typeof response === "string" && response.trim()) return response;
      // JSON に対応したモデルは、response をパース済みのオブジェクトで返すことがある
      if (response && typeof response === "object") return JSON.stringify(response);
      throw new ProviderError(name, "empty response");
    },
  };
}
