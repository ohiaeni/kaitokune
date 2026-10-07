import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  type ApiErrorBody,
  dateSchema,
  type Entry,
  type EntryDetail,
  type EntrySummary,
  monthSchema,
  saveEntryRequestSchema,
} from "../../shared/schemas";
import { entries, qaLogs } from "../db/schema";
import type { AppEnv } from "../types";
import { validationHook } from "../validation";

const EXCERPT_LENGTH = 80;
const LIST_LIMIT = 100;

const dateParam = zValidator("param", z.object({ date: dateSchema }), validationHook);

export const entryRoutes = new Hono<AppEnv>()
  .get("/", zValidator("query", z.object({ month: monthSchema.optional() }), validationHook), async (c) => {
    const { month } = c.req.valid("query");
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
  })
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
  .delete("/:date", dateParam, async (c) => {
    const { date } = c.req.valid("param");
    const db = c.get("db");
    await db.batch([
      db.delete(qaLogs).where(eq(qaLogs.entryDate, date)),
      db.delete(entries).where(eq(entries.date, date)),
    ]);
    return c.body(null, 204);
  });
