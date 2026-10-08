import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { todayIn } from "../../shared/date";
import {
  type ComposeResponse,
  composeRequestSchema,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  type NextResponse,
  nextRequestSchema,
} from "../../shared/schemas";
import { listRecentEntries } from "../db/entries";
import { listNotes } from "../db/notes";
import type { AppEnv } from "../types";
import { consumeAiQuota } from "../usage";
import { validationHook } from "../validation";

const RECENT_ENTRIES = 3;
const RECENT_EXCERPT_LENGTH = 150;

export const chatRoutes = new Hono<AppEnv>()
  .post("/next", zValidator("json", nextRequestSchema, validationHook), async (c) => {
    const { date, qa } = c.req.valid("json");
    if (qa.length >= MAX_QUESTIONS) return c.json<NextResponse>({ done: true });

    const db = c.get("db");
    const userId = c.get("userId");
    await consumeAiQuota(db, userId, todayIn(c.env.TIMEZONE), Number(c.env.AI_DAILY_LIMIT));

    // 最初の質問だけ、直近の日記を文脈に入れてパーソナライズする
    const recent =
      qa.length === 0
        ? (await listRecentEntries(db, userId, date, RECENT_ENTRIES)).map(
            (e) => `${e.date}: ${e.body.slice(0, RECENT_EXCERPT_LENGTH)}`,
          )
        : [];

    const notes = (await listNotes(db, userId, date)).map((n) => n.body);
    const result = await c.get("ai").nextQuestion({ date, qa, notes, recent, allowDone: qa.length >= MIN_QUESTIONS });
    return c.json<NextResponse>(result);
  })
  .post("/compose", zValidator("json", composeRequestSchema, validationHook), async (c) => {
    const { date, qa } = c.req.valid("json");
    const db = c.get("db");
    const userId = c.get("userId");
    await consumeAiQuota(db, userId, todayIn(c.env.TIMEZONE), Number(c.env.AI_DAILY_LIMIT));
    const notes = (await listNotes(db, userId, date)).map((n) => n.body);
    const body = await c.get("ai").composeDiary({ date, qa, notes });
    return c.json<ComposeResponse>({ body });
  });
