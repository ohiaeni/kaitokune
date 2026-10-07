import { type Prompt, ProviderError, type TextGenerator } from "./provider";

type ContentPart = { type?: string; text?: string };
type WorkersAIResult = {
  /** 旧来のモデルの形式 */
  response?: unknown;
  /** 新しいモデル（Gemma 4 など）の OpenAI 互換形式 */
  choices?: { message?: { content?: string | ContentPart[] | null } }[];
};

/** モデルの出力形式の違いを吸収してテキストを取り出す */
export function extractText(result: unknown): string | null {
  const r = result as WorkersAIResult | null;

  const content = r?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content.map((p) => p.text ?? "").join("");
    if (text.trim()) return text;
  }

  const response = r?.response;
  if (typeof response === "string" && response.trim()) return response;
  // JSON に対応したモデルは、response をパース済みのオブジェクトで返すことがある
  if (response && typeof response === "object") return JSON.stringify(response);

  return null;
}

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
            // 推論（thinking）に対応したモデルで思考を止める。日記の質問や文章には不要で、
            // 有効だと思考だけで max_tokens を使い切り、本文が空になる
            chat_template_kwargs: { enable_thinking: false },
          } as never,
        );
      } catch (e) {
        throw new ProviderError(name, e instanceof Error ? e.message : String(e));
      }

      const text = extractText(result);
      if (text === null) throw new ProviderError(name, `unexpected response: ${JSON.stringify(result).slice(0, 300)}`);
      return text;
    },
  };
}
