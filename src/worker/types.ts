import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { DiaryAI } from "./ai";
import type { Bindings } from "./env";

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    db: DrizzleD1Database;
    /** AI を呼ぶたびに 1 日の呼び出し回数を数える（middleware/ai-quota.ts） */
    ai: DiaryAI;
    /** 外部 API（Cloudflare の GraphQL Analytics API）の呼び出しに使う。テストではモックを差し込む */
    fetcher: typeof fetch;
    /** ログインしているユーザーの users.id。すべてのデータはこれで絞り込む */
    userId: number;
  };
};
