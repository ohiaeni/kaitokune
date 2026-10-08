import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { todayIn } from "../../shared/date";
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
import { changeEntryDate, deleteEntry, getEntry, listEntries, saveEntry, searchEntries } from "../db/entries";
import type { AppEnv } from "../types";
import { validationHook } from "../validation";

const dateParam = zValidator("param", z.object({ date: dateSchema }), validationHook);

const notFoundBody = (date: string): ApiErrorBody => ({ error: "not_found", message: `${date} の日記はありません` });

export const entryRoutes = new Hono<AppEnv>()
  .get(
    "/",
    zValidator("query", z.object({ month: monthSchema.optional(), q: searchQuerySchema.optional() }), validationHook),
    async (c) => {
      const { month, q } = c.req.valid("query");
      const db = c.get("db");
      const userId = c.get("userId");
      return c.json<EntrySummary[]>(q ? await searchEntries(db, userId, q) : await listEntries(db, userId, month));
    },
  )
  .get("/:date", dateParam, async (c) => {
    const { date } = c.req.valid("param");
    const detail = await getEntry(c.get("db"), c.get("userId"), date);
    if (!detail) return c.json<ApiErrorBody>(notFoundBody(date), 404);
    return c.json<EntryDetail>(detail);
  })
  .put("/:date", dateParam, zValidator("json", saveEntryRequestSchema, validationHook), async (c) => {
    const { date } = c.req.valid("param");
    const { body, mood = null, qa } = c.req.valid("json");
    return c.json<Entry>(await saveEntry(c.get("db"), c.get("userId"), date, { body, mood, qa }));
  })
  .patch("/:date", dateParam, zValidator("json", changeDateRequestSchema, validationHook), async (c) => {
    const { date } = c.req.valid("param");
    const { date: newDate } = c.req.valid("json");
    if (newDate > todayIn(c.env.TIMEZONE)) {
      return c.json<ApiErrorBody>({ error: "invalid_request", message: "未来の日付には変更できません" }, 400);
    }
    const result = await changeEntryDate(c.get("db"), c.get("userId"), date, newDate);
    if (result.status === "not_found") return c.json<ApiErrorBody>(notFoundBody(date), 404);
    if (result.status === "conflict") {
      return c.json<ApiErrorBody>({ error: "conflict", message: `${newDate} にはすでに日記があります` }, 409);
    }
    return c.json<Entry>(result.entry);
  })
  .delete("/:date", dateParam, async (c) => {
    const { date } = c.req.valid("param");
    await deleteEntry(c.get("db"), c.get("userId"), date);
    return c.body(null, 204);
  });
