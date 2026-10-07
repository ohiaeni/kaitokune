/** wrangler.jsonc のバインディングと vars（`npm run cf-typegen` で生成される Env）に、シークレットを加えたもの */
export type Bindings = Env & {
  /** 任意。未設定なら Gemini へのフォールバックは行わない */
  GEMINI_API_KEY?: string;
};
