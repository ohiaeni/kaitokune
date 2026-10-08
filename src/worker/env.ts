/** wrangler.jsonc のバインディングと vars（`npm run cf-typegen` で生成される Env）に、シークレットを加えたもの */
export type Bindings = Env & {
  /** 任意。未設定なら Gemini へのフォールバックは行わない */
  GEMINI_API_KEY?: string;
  /** 任意。「Account Analytics: Read」の API トークン。未設定なら Cloudflare の消費状況は表示しない */
  CF_ANALYTICS_TOKEN?: string;
  /** 任意。CF_ANALYTICS_TOKEN と組で使うアカウント ID */
  CF_ACCOUNT_ID?: string;
  /** 本番で必須。Cloudflare Access のチームドメイン（例: https://<team>.cloudflareaccess.com） */
  ACCESS_TEAM_DOMAIN?: string;
  /** 本番で必須。Access アプリケーションの Application Audience (AUD) タグ */
  ACCESS_AUD?: string;
  /**
   * ローカル開発専用（.dev.vars に書く）。Access を通らないので、このメールアドレスのユーザーとして扱う。
   * ACCESS_TEAM_DOMAIN・ACCESS_AUD があるときは無視する（本番で JWT の検証を飛ばせないようにする）
   */
  DEV_USER_EMAIL?: string;
};
