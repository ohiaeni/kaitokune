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

type ProviderErrorOptions = ErrorOptions & { provider: string; status?: number };

export class ProviderError extends Error {
  readonly provider: string;
  readonly status?: number;

  constructor(message: string, { provider, status, ...options }: ProviderErrorOptions) {
    super(`[${provider}] ${message}`, options);
    this.name = "ProviderError";
    this.provider = provider;
    this.status = status;
  }
}
