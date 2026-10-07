import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import type { ApiErrorBody } from "../shared/schemas";
import { createDiaryAI, createGeneratorsFromEnv, type DiaryAI } from "./ai";
import { AllProvidersFailedError } from "./ai/fallback";
import type { Bindings } from "./env";
import { chatRoutes } from "./routes/chat";
import { entryRoutes } from "./routes/entries";
import type { AppEnv } from "./types";
import { DailyLimitError } from "./usage";

export type AppOptions = {
  /** テストではモックの AI を差し込む */
  createAI?: (env: Bindings) => DiaryAI;
};

export function createApp({ createAI = (env) => createDiaryAI(createGeneratorsFromEnv(env)) }: AppOptions = {}) {
  return new Hono<AppEnv>()
    .basePath("/api")
    .use(async (c, next) => {
      c.set("db", drizzle(c.env.DB));
      c.set("ai", createAI(c.env));
      await next();
    })
    .route("/chat", chatRoutes)
    .route("/entries", entryRoutes)
    .notFound((c) => c.json<ApiErrorBody>({ error: "not_found", message: "Not Found" }, 404))
    .onError((err, c) => {
      if (err instanceof DailyLimitError) {
        return c.json<ApiErrorBody>(
          { error: "daily_limit", message: `今日の AI 利用上限（${err.limit} 回）に達しました` },
          429,
        );
      }
      if (err instanceof AllProvidersFailedError) {
        return c.json<ApiErrorBody>(
          { error: "ai_unavailable", message: "AI に接続できませんでした。時間をおいて試してください" },
          502,
        );
      }
      console.error(err);
      return c.json<ApiErrorBody>({ error: "internal", message: "Internal Server Error" }, 500);
    });
}
