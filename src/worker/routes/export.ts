import { zValidator } from "@hono/zod-validator";
import { asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { Hono } from "hono";
import { todayIn } from "../../shared/date";
import { type ExportFile, exportQuerySchema, type QA } from "../../shared/schemas";
import { entries, qaLogs } from "../db/schema";
import { toMarkdown } from "../export/markdown";
import type { AppEnv } from "../types";
import { validationHook } from "../validation";
import { entryColumns } from "./entries";

async function loadAll(db: DrizzleD1Database, userId: number): Promise<ExportFile["entries"]> {
  const [rows, logs] = await db.batch([
    db.select(entryColumns).from(entries).where(eq(entries.userId, userId)).orderBy(asc(entries.date)),
    db
      .select({ entryDate: qaLogs.entryDate, question: qaLogs.question, answer: qaLogs.answer })
      .from(qaLogs)
      .where(eq(qaLogs.userId, userId))
      .orderBy(asc(qaLogs.entryDate), asc(qaLogs.position)),
  ]);
  const qaByDate = new Map<string, QA[]>();
  for (const { entryDate, question, answer } of logs) {
    const qa = qaByDate.get(entryDate) ?? [];
    qa.push({ question, answer });
    qaByDate.set(entryDate, qa);
  }
  return rows.map((entry) => ({ ...entry, qa: qaByDate.get(entry.date) ?? [] }));
}

export const exportRoutes = new Hono<AppEnv>().get(
  "/",
  zValidator("query", exportQuerySchema, validationHook),
  async (c) => {
    const { format } = c.req.valid("query");
    const file: ExportFile = {
      format: "kaitokune",
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: await loadAll(c.get("db"), c.get("userId")),
    };
    const filename = `kaitokune-${todayIn(c.env.TIMEZONE)}.${format === "json" ? "json" : "md"}`;
    c.header("content-disposition", `attachment; filename="${filename}"`);
    c.header("cache-control", "no-store");
    if (format === "json") return c.json(file);
    c.header("content-type", "text/markdown; charset=utf-8");
    return c.body(toMarkdown(file));
  },
);
