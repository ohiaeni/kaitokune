import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { aiUsage } from "./db/schema";

export class DailyLimitError extends Error {
  constructor(readonly limit: number) {
    super(`daily AI limit (${limit}) exceeded`);
    this.name = "DailyLimitError";
  }
}

/** 指定タイムゾーンでの今日の日付（YYYY-MM-DD） */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * 今日の AI 呼び出し回数を 1 増やし、上限を超えていたら DailyLimitError を投げる。
 * 無料枠を使い切らないよう、AI を呼ぶ前に必ず通す。
 */
export async function consumeAiQuota(db: DrizzleD1Database, date: string, limit: number): Promise<number> {
  const [row] = await db
    .insert(aiUsage)
    .values({ date, count: 1 })
    .onConflictDoUpdate({ target: aiUsage.date, set: { count: sql`${aiUsage.count} + 1` } })
    .returning({ count: aiUsage.count });
  if (row.count > limit) throw new DailyLimitError(limit);
  return row.count;
}
