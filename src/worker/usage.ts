import type { DrizzleD1Database } from "drizzle-orm/d1";
import { incrementAiUsage } from "./db/ai-usage";

export class DailyLimitError extends Error {
  constructor(readonly limit: number) {
    super(`daily AI limit (${limit}) exceeded`);
    this.name = "DailyLimitError";
  }
}

/**
 * 今日の AI 呼び出し回数を 1 増やし、上限を超えていたら DailyLimitError を投げる。
 * 無料枠を使い切らないよう、AI を呼ぶ前に必ず通す。
 */
export async function consumeAiQuota(
  db: DrizzleD1Database,
  userId: number,
  date: string,
  limit: number,
): Promise<number> {
  const count = await incrementAiUsage(db, userId, date);
  if (count > limit) throw new DailyLimitError(limit);
  return count;
}
