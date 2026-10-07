import { describe, expect, it } from "vitest";
import { AllProvidersFailedError, generateWithFallback } from "../src/worker/ai/fallback";
import { createGemini } from "../src/worker/ai/gemini";
import { parseDiary, parseNextQuestion } from "../src/worker/ai/prompts";
import { type Prompt, ProviderError, type TextGenerator } from "../src/worker/ai/provider";
import { extractText } from "../src/worker/ai/workers-ai";

const prompt: Prompt = { system: "sys", user: "user", json: true };

function generator(name: string, impl: () => string | Promise<string>): TextGenerator & { calls: number } {
  const g = {
    name,
    calls: 0,
    async generate() {
      g.calls++;
      return impl();
    },
  };
  return g;
}

describe("generateWithFallback", () => {
  it("uses the first provider when it succeeds", async () => {
    const a = generator("a", () => "A");
    const b = generator("b", () => "B");
    expect(await generateWithFallback([a, b], prompt, (t) => t)).toBe("A");
    expect(b.calls).toBe(0);
  });

  it("falls back when a provider throws (e.g. 429)", async () => {
    const a = generator("a", () => {
      throw new ProviderError("a", "HTTP 429", 429);
    });
    const b = generator("b", () => "B");
    expect(await generateWithFallback([a, b], prompt, (t) => t)).toBe("B");
  });

  it("falls back when the output cannot be parsed", async () => {
    const a = generator("a", () => "not json");
    const b = generator("b", () => '{"question": "今日はどうでしたか？"}');
    expect(await generateWithFallback([a, b], prompt, (t) => parseNextQuestion(t, false))).toEqual({
      question: "今日はどうでしたか？",
    });
  });

  it("throws AllProvidersFailedError when every provider fails", async () => {
    const a = generator("a", () => {
      throw new Error("down");
    });
    await expect(generateWithFallback([a], prompt, (t) => t)).rejects.toBeInstanceOf(AllProvidersFailedError);
  });
});

describe("parseNextQuestion", () => {
  it("extracts JSON wrapped in a code block with a preamble", () => {
    const text = 'はい、次の質問です。\n```json\n{"question": "何を食べましたか？"}\n```';
    expect(parseNextQuestion(text, false)).toEqual({ question: "何を食べましたか？" });
  });

  it("accepts done only when allowed", () => {
    expect(parseNextQuestion('{"done": true}', true)).toEqual({ done: true });
    expect(() => parseNextQuestion('{"done": true}', false)).toThrow();
  });

  it("rejects empty questions", () => {
    expect(() => parseNextQuestion('{"question": "  "}', false)).toThrow();
  });
});

describe("parseDiary", () => {
  it("strips code fences and whitespace", () => {
    expect(parseDiary("```\n今日は朝から雨だった。傘を忘れた。\n```\n")).toBe("今日は朝から雨だった。傘を忘れた。");
  });

  it("rejects output that is too short", () => {
    expect(() => parseDiary("はい")).toThrow();
  });
});

describe("createGemini", () => {
  it("sends the API key and JSON mode, and joins the response parts", async () => {
    let captured: Request | undefined;
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = new Request(input, init);
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"question":' }, { text: '"Q"}' }] } }] });
    }) as typeof fetch;

    const gemini = createGemini("test-key", "gemini-flash-latest", fetcher);
    expect(await gemini.generate(prompt)).toBe('{"question":"Q"}');

    expect(captured?.url).toContain("/models/gemini-flash-latest:generateContent");
    expect(captured?.headers.get("x-goog-api-key")).toBe("test-key");
    const body = (await captured?.json()) as { generationConfig: { responseMimeType?: string } };
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("throws ProviderError with the HTTP status on failure", async () => {
    const fetcher = (async () => new Response("quota exceeded", { status: 429 })) as unknown as typeof fetch;
    const error = await createGemini("k", "m", fetcher)
      .generate(prompt)
      .catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.status).toBe(429);
  });
});

describe("Workers AI extractText", () => {
  it("reads the OpenAI-compatible format used by newer models", () => {
    expect(extractText({ choices: [{ message: { content: "こんにちは" } }] })).toBe("こんにちは");
    expect(extractText({ choices: [{ message: { content: [{ type: "text", text: "a" }, { text: "b" }] } }] })).toBe(
      "ab",
    );
  });

  it("reads the legacy response format", () => {
    expect(extractText({ response: "こんにちは" })).toBe("こんにちは");
    expect(extractText({ response: { question: "Q" } })).toBe('{"question":"Q"}');
  });

  it("returns null when there is no text", () => {
    expect(extractText({ choices: [{ message: { content: null } }] })).toBeNull();
    expect(extractText({ response: "  " })).toBeNull();
    expect(extractText(null)).toBeNull();
  });
});
