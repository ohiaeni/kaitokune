import { type Prompt, ProviderError, type TextGenerator } from "./provider";

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

/** Google Gemini API（無料ティア。カードを登録しなければ課金されない） */
export function createGemini(apiKey: string, model: string, fetcher: typeof fetch = fetch): TextGenerator {
  const name = `gemini:${model}`;
  return {
    name,
    async generate(prompt: Prompt) {
      const res = await fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: prompt.system }] },
            contents: [{ role: "user", parts: [{ text: prompt.user }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
              ...(prompt.json ? { responseMimeType: "application/json" } : {}),
            },
          }),
        },
      );
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        throw new ProviderError(`HTTP ${res.status} ${detail}`, { provider: name, status: res.status });
      }

      const data = (await res.json()) as GeminiResponse;
      const text = data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim();
      if (!text) throw new ProviderError("empty response", { provider: name });
      return text;
    },
  };
}
