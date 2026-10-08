import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { MiddlewareHandler } from "hono";
import { todayIn } from "../../shared/date";
import type { DiaryAI } from "../ai";
import { incrementAiUsage } from "../db/ai-usage";
import type { Bindings } from "../env";
import type { AppEnv } from "../types";

export class DailyLimitError extends Error {
  constructor(readonly limit: number) {
    super(`daily AI limit (${limit}) exceeded`);
    this.name = "DailyLimitError";
  }
}

/** 今日の AI 呼び出し回数を 1 増やし、上限を超えていたら DailyLimitError を投げる */
async function consumeAiQuota(db: DrizzleD1Database, userId: number, env: Bindings): Promise<void> {
  const count = await incrementAiUsage(db, userId, todayIn(env.TIMEZONE));
  const limit = Number(env.AI_DAILY_LIMIT);
  if (count > limit) throw new DailyLimitError(limit);
}

/**
 * 1 日の AI 呼び出し上限（AI_DAILY_LIMIT）を数える AI を Context に入れる（userId を入れたあとに使う）。
 * 無料枠を使い切らないよう、Context の AI はどのメソッドも呼ぶ前に回数を数える。
 * 実際に AI を呼んだときだけ数えるので、入力の検証で断ったリクエストや、AI を呼ばずに返すリクエストは数えない
 */
export function aiQuota(createAI: (env: Bindings) => DiaryAI): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const ai = createAI(c.env);
    const consume = () => consumeAiQuota(c.get("db"), c.get("userId"), c.env);
    c.set("ai", {
      async nextQuestion(input) {
        await consume();
        return ai.nextQuestion(input);
      },
      async composeDiary(input) {
        await consume();
        return ai.composeDiary(input);
      },
    });
    await next();
  };
}
