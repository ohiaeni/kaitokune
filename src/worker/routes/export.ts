import { zValidator } from "@hono/zod-validator";
import { asc } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { Hono } from "hono";
import { type ExportFile, exportQuerySchema, MOODS, type QA } from "../../shared/schemas";
import { entries, qaLogs } from "../db/schema";
import type { AppEnv } from "../types";
import { todayIn } from "../usage";
import { validationHook } from "../validation";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

async function loadAll(db: DrizzleD1Database): Promise<ExportFile["entries"]> {
  const [rows, logs] = await db.batch([
    db.select().from(entries).orderBy(asc(entries.date)),
    db
      .select({ entryDate: qaLogs.entryDate, question: qaLogs.question, answer: qaLogs.answer })
      .from(qaLogs)
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

/** "2026-10-08" → "2026年10月8日（木）" */
function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日（${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`;
}

/** 人が読むための Markdown。1 日ごとに見出し・気分・本文を並べ、AI との会話は折りたたむ */
function toMarkdown(file: ExportFile): string {
  const sections = file.entries.map((entry) => {
    const lines = [`## ${formatDate(entry.date)}`, ""];
    const mood = MOODS.find((m) => m.value === entry.mood);
    if (mood) lines.push(`気分: ${mood.emoji} ${mood.label}`, "");
    lines.push(entry.body);
    if (entry.qa.length > 0) {
      lines.push("", "<details>", "<summary>AI との会話</summary>", "");
      for (const { question, answer } of entry.qa) lines.push(`**Q. ${question}**`, "", `A. ${answer}`, "");
      lines.push("</details>");
    }
    return lines.join("\n");
  });
  return [`# kaitokune の日記`, "", `${file.exportedAt} にエクスポート（${file.entries.length} 件）`, ...sections]
    .join("\n\n")
    .concat("\n");
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
      entries: await loadAll(c.get("db")),
    };
    const filename = `kaitokune-${todayIn(c.env.TIMEZONE)}.${format === "json" ? "json" : "md"}`;
    c.header("content-disposition", `attachment; filename="${filename}"`);
    c.header("cache-control", "no-store");
    if (format === "json") return c.json(file);
    c.header("content-type", "text/markdown; charset=utf-8");
    return c.body(toMarkdown(file));
  },
);
