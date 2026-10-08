// AI の呼び出し回数（ai_usage）のデータアクセス。どの関数も userId で絞り込む
import { desc, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { aiUsage } from "./schema";

/** その日の呼び出し回数を 1 増やし、増やしたあとの回数を返す */
export async function incrementAiUsage(db: DrizzleD1Database, userId: number, date: string): Promise<number> {
  const [row] = await db
    .insert(aiUsage)
    .values({ userId, date, count: 1 })
    .onConflictDoUpdate({ target: [aiUsage.userId, aiUsage.date], set: { count: sql`${aiUsage.count} + 1` } })
    .returning({ count: aiUsage.count });
  return row.count;
}

/** 直近 days 日分の呼び出し回数を新しい順に返す（使った日だけ） */
export function listAiUsage(
  db: DrizzleD1Database,
  userId: number,
  days: number,
): Promise<{ date: string; count: number }[]> {
  return db
    .select({ date: aiUsage.date, count: aiUsage.count })
    .from(aiUsage)
    .where(eq(aiUsage.userId, userId))
    .orderBy(desc(aiUsage.date))
    .limit(days);
}
