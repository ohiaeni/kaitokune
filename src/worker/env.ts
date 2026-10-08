/** wrangler.jsonc のバインディングと vars（`npm run cf-typegen` で生成される Env）に、シークレットを加えたもの */
export type Bindings = Env & {
  /** 任意。未設定なら Gemini へのフォールバックは行わない */
  GEMINI_API_KEY?: string;
  /** 任意。「Account Analytics: Read」の API トークン。未設定なら Cloudflare の消費状況は表示しない */
  CF_ANALYTICS_TOKEN?: string;
  /** 任意。CF_ANALYTICS_TOKEN と組で使うアカウント ID */
  CF_ACCOUNT_ID?: string;
};
