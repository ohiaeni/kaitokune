import { zValidator } from "@hono/zod-validator";
import { asc, count, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { type ApiErrorBody, createNoteRequestSchema, dateSchema, MAX_NOTES, type Note } from "../../shared/schemas";
import { notes } from "../db/schema";
import type { AppEnv } from "../types";
import { validationHook } from "../validation";

/** その日のメモを書いた順に返す */
export function listNotes(db: DrizzleD1Database, date: string): Promise<Note[]> {
  return db.select().from(notes).where(eq(notes.date, date)).orderBy(asc(notes.createdAt), asc(notes.id));
}

export const noteRoutes = new Hono<AppEnv>()
  .get("/", zValidator("query", z.object({ date: dateSchema }), validationHook), async (c) => {
    const { date } = c.req.valid("query");
    return c.json<Note[]>(await listNotes(c.get("db"), date));
  })
  .post("/", zValidator("json", createNoteRequestSchema, validationHook), async (c) => {
    const { date, body } = c.req.valid("json");
    const db = c.get("db");
    const [{ total }] = await db.select({ total: count() }).from(notes).where(eq(notes.date, date));
    if (total >= MAX_NOTES) {
      return c.json<ApiErrorBody>({ error: "invalid_request", message: `メモは 1 日 ${MAX_NOTES} 件までです` }, 400);
    }
    const [note] = await db.insert(notes).values({ date, body, createdAt: Date.now() }).returning();
    return c.json<Note>(note, 201);
  })
  .delete(
    "/:id",
    zValidator("param", z.object({ id: z.coerce.number().int().positive() }), validationHook),
    async (c) => {
      const { id } = c.req.valid("param");
      await c.get("db").delete(notes).where(eq(notes.id, id));
      return c.body(null, 204);
    },
  );
