import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiErrorBody } from "../shared/schemas";
import { AccessError } from "./access";
import { AllProvidersFailedError } from "./ai/fallback";
import { DailyLimitError } from "./middleware/ai-quota";
import type { AppEnv } from "./types";

/** 投げられたエラーを、API のエラー（ステータスと本文）に変換する */
function toApiError(err: Error): { status: ContentfulStatusCode; body: ApiErrorBody } {
  if (err instanceof AccessError) {
    console.warn(`access denied: ${err.message}`);
    return { status: 401, body: { error: "unauthorized", message: "ログインを確認できませんでした" } };
  }
  if (err instanceof DailyLimitError) {
    return {
      status: 429,
      body: { error: "daily_limit", message: `今日の AI 利用上限（${err.limit} 回）に達しました` },
    };
  }
  if (err instanceof AllProvidersFailedError) {
    return {
      status: 502,
      body: { error: "ai_unavailable", message: "AI に接続できませんでした。時間をおいて試してください" },
    };
  }
  console.error(err);
  return { status: 500, body: { error: "internal", message: "Internal Server Error" } };
}

export const handleError: ErrorHandler<AppEnv> = (err, c) => {
  const { status, body } = toApiError(err);
  return c.json<ApiErrorBody>(body, status);
};
