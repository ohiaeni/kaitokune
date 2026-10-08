import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, exists, gte, inArray, lte, or, type SQL, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import { z } from "zod";
import {
  type ApiErrorBody,
  changeDateRequestSchema,
  dateSchema,
  type Entry,
  type EntryDetail,
  type EntrySummary,
  monthSchema,
  saveEntryRequestSchema,
  searchQuerySchema,
} from "../../shared/schemas";
import { entries, qaLogs } from "../db/schema";
import type { AppEnv } from "../types";
import { todayIn } from "../usage";
import { validationHook } from "../validation";

const EXCERPT_LENGTH = 80;
const LIST_LIMIT = 100;
const SEARCH_LIMIT = 50;
/** 検索結果の抜粋で、一致した箇所より前に残す文字数 */
const SEARCH_CONTEXT = 20;

/** LIKE の特殊文字（% と _、エスケープ文字の \）をエスケープし、部分一致のパターンにする */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

function contains(column: SQLiteColumn, pattern: string): SQL {
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}

/** 一致した箇所の前後を切り出す。LIKE と同じく ASCII の大文字・小文字は区別しない */
function excerptAround(text: string, q: string): string {
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index < 0) return text.slice(0, EXCERPT_LENGTH);
  const start = Math.max(0, index - SEARCH_CONTEXT);
  const end = start + EXCERPT_LENGTH;
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

async function searchEntries(db: DrizzleD1Database, q: string): Promise<EntrySummary[]> {
  const pattern = likePattern(q);
  const qaMatches = and(
    eq(qaLogs.entryDate, entries.date),
    or(contains(qaLogs.question, pattern), contains(qaLogs.answer, pattern)),
  );
  const rows = await db
    .select({ date: entries.date, body: entries.body, mood: entries.mood })
    .from(entries)
    .where(or(contains(entries.body, pattern), exists(db.select({ id: qaLogs.id }).from(qaLogs).where(qaMatches))))
    .orderBy(desc(entries.date))
    .limit(SEARCH_LIMIT);

  // 本文に一致しなかった日記は、一致した問答から抜粋を作る
  const lower = q.toLowerCase();
  const qaOnly = rows.filter((r) => !r.body.toLowerCase().includes(lower)).map((r) => r.date);
  const qaTexts = new Map<string, string>();
  if (qaOnly.length > 0) {
    const logs = await db
      .select({ date: qaLogs.entryDate, question: qaLogs.question, answer: qaLogs.answer })
      .from(qaLogs)
      .where(inArray(qaLogs.entryDate, qaOnly))
      .orderBy(asc(qaLogs.entryDate), asc(qaLogs.position));
    for (const log of logs) {
      if (qaTexts.has(log.date)) continue;
      if (log.answer.toLowerCase().includes(lower)) qaTexts.set(log.date, log.answer);
      else if (log.question.toLowerCase().includes(lower)) qaTexts.set(log.date, log.question);
    }
  }

  return rows.map((r) => ({
    date: r.date,
    excerpt: excerptAround(qaTexts.get(r.date) ?? r.body, q),
    mood: r.mood,
  }));
}

const dateParam = zValidator("param", z.object({ date: dateSchema }), validationHook);

export const entryRoutes = new Hono<AppEnv>()
  .get(
    "/",
    zValidator("query", z.object({ month: monthSchema.optional(), q: searchQuerySchema.optional() }), validationHook),
    async (c) => {
      const { month, q } = c.req.valid("query");
      if (q) return c.json<EntrySummary[]>(await searchEntries(c.get("db"), q));
      const rows = await c
        .get("db")
        .select({ date: entries.date, body: entries.body, mood: entries.mood })
        .from(entries)
        .where(month ? and(gte(entries.date, `${month}-01`), lte(entries.date, `${month}-31`)) : undefined)
        .orderBy(desc(entries.date))
        .limit(LIST_LIMIT);
      return c.json<EntrySummary[]>(
        rows.map((r) => ({ date: r.date, excerpt: r.body.slice(0, EXCERPT_LENGTH), mood: r.mood })),
      );
    },
  )
  .get("/:date", dateParam, async (c) => {
    const { date } = c.req.valid("param");
    const db = c.get("db");
    const [entry] = await db.select().from(entries).where(eq(entries.date, date));
    if (!entry) return c.json<ApiErrorBody>({ error: "not_found", message: `${date} の日記はありません` }, 404);
    const qa = await db
      .select({ question: qaLogs.question, answer: qaLogs.answer })
      .from(qaLogs)
      .where(eq(qaLogs.entryDate, date))
      .orderBy(asc(qaLogs.position));
    return c.json<EntryDetail>({ entry, qa });
  })
  .put("/:date", dateParam, zValidator("json", saveEntryRequestSchema, validationHook), async (c) => {
    const { date } = c.req.valid("param");
    const { body, mood = null, qa } = c.req.valid("json");
    const db = c.get("db");
    const now = Date.now();

    const upsert = db
      .insert(entries)
      .values({ date, body, mood, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: entries.date, set: { body, mood, updatedAt: now } })
      .returning();

    // qa が送られてきたときだけ、会話ログを丸ごと入れ替える（本文だけの編集では既存のログを残す）
    if (qa) {
      const deleteQa = db.delete(qaLogs).where(eq(qaLogs.entryDate, date));
      const [[entry]] =
        qa.length > 0
          ? await db.batch([
              upsert,
              deleteQa,
              db.insert(qaLogs).values(qa.map((x, i) => ({ entryDate: date, position: i, ...x }))),
            ])
          : await db.batch([upsert, deleteQa]);
      return c.json<Entry>(entry);
    }

    const [entry] = await upsert;
    return c.json<Entry>(entry);
  })
  .patch("/:date", dateParam, zValidator("json", changeDateRequestSchema, validationHook), async (c) => {
    const { date } = c.req.valid("param");
    const { date: newDate } = c.req.valid("json");
    const db = c.get("db");

    if (newDate > todayIn(c.env.TIMEZONE)) {
      return c.json<ApiErrorBody>({ error: "invalid_request", message: "未来の日付には変更できません" }, 400);
    }
    const [entry] = await db.select().from(entries).where(eq(entries.date, date));
    if (!entry) return c.json<ApiErrorBody>({ error: "not_found", message: `${date} の日記はありません` }, 404);
    if (newDate === date) return c.json<Entry>(entry);
    const [existing] = await db.select({ date: entries.date }).from(entries).where(eq(entries.date, newDate));
    if (existing) {
      return c.json<ApiErrorBody>({ error: "conflict", message: `${newDate} にはすでに日記があります` }, 409);
    }

    // date は主キーで qa_logs から参照されているため、新しい日付の行を作って会話ログを付け替えてから古い行を消す
    const [[moved]] = await db.batch([
      db
        .insert(entries)
        .values({ ...entry, date: newDate, updatedAt: Date.now() })
        .returning(),
      db.update(qaLogs).set({ entryDate: newDate }).where(eq(qaLogs.entryDate, date)),
      db.delete(entries).where(eq(entries.date, date)),
    ]);
    return c.json<Entry>(moved);
  })
  .delete("/:date", dateParam, async (c) => {
    const { date } = c.req.valid("param");
    const db = c.get("db");
    await db.batch([
      db.delete(qaLogs).where(eq(qaLogs.entryDate, date)),
      db.delete(entries).where(eq(entries.date, date)),
    ]);
    return c.body(null, 204);
  });
