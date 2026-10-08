import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { DiaryAI } from "./ai";
import type { Bindings } from "./env";

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    db: DrizzleD1Database;
    ai: DiaryAI;
    /** 外部 API（Cloudflare の GraphQL Analytics API）の呼び出しに使う。テストではモックを差し込む */
    fetcher: typeof fetch;
    /** Access で確かめた、ログインしているユーザーのメールアドレス（小文字） */
    userEmail: string;
  };
};
