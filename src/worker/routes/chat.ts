import { zValidator } from "@hono/zod-validator";
import { desc, lt } from "drizzle-orm";
import { Hono } from "hono";
import {
  type ComposeResponse,
  composeRequestSchema,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  type NextResponse,
  nextRequestSchema,
} from "../../shared/schemas";
import { entries } from "../db/schema";
import type { AppEnv } from "../types";
import { consumeAiQuota, todayIn } from "../usage";
import { validationHook } from "../validation";

const RECENT_ENTRIES = 3;
const RECENT_EXCERPT_LENGTH = 150;

export const chatRoutes = new Hono<AppEnv>()
  .post("/next", zValidator("json", nextRequestSchema, validationHook), async (c) => {
    const { date, qa } = c.req.valid("json");
    if (qa.length >= MAX_QUESTIONS) return c.json<NextResponse>({ done: true });

    const db = c.get("db");
    await consumeAiQuota(db, todayIn(c.env.TIMEZONE), Number(c.env.AI_DAILY_LIMIT));

    // 最初の質問だけ、直近の日記を文脈に入れてパーソナライズする
    const recent =
      qa.length === 0
        ? (
            await db
              .select({ date: entries.date, body: entries.body })
              .from(entries)
              .where(lt(entries.date, date))
              .orderBy(desc(entries.date))
              .limit(RECENT_ENTRIES)
          ).map((e) => `${e.date}: ${e.body.slice(0, RECENT_EXCERPT_LENGTH)}`)
        : [];

    const result = await c.get("ai").nextQuestion({ date, qa, recent, allowDone: qa.length >= MIN_QUESTIONS });
    return c.json<NextResponse>(result);
  })
  .post("/compose", zValidator("json", composeRequestSchema, validationHook), async (c) => {
    const { date, qa } = c.req.valid("json");
    await consumeAiQuota(c.get("db"), todayIn(c.env.TIMEZONE), Number(c.env.AI_DAILY_LIMIT));
    const body = await c.get("ai").composeDiary({ date, qa });
    return c.json<ComposeResponse>({ body });
  });
