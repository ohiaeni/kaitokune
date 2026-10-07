/** プロバイダに渡すプロンプト。`json: true` のときは JSON だけを返すよう要求する */
export type Prompt = {
  system: string;
  user: string;
  json: boolean;
};

/** テキスト生成 AI の最小インターフェース。プロバイダ（Workers AI / Gemini など）ごとに実装する */
export interface TextGenerator {
  name: string;
  generate(prompt: Prompt): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}
