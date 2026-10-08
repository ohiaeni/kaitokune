import { zValidator } from "@hono/zod-validator";
import { and, asc, count, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { type ApiErrorBody, createNoteRequestSchema, dateSchema, MAX_NOTES, type Note } from "../../shared/schemas";
import { notes } from "../db/schema";
import type { AppEnv } from "../types";
import { validationHook } from "../validation";

/** API で返すメモの列（user_id は返さない） */
const noteColumns = { id: notes.id, date: notes.date, body: notes.body, createdAt: notes.createdAt };

const ownNotes = (userId: number, date: string) => and(eq(notes.userId, userId), eq(notes.date, date));

/** そのユーザーのその日のメモを書いた順に返す */
export function listNotes(db: DrizzleD1Database, userId: number, date: string): Promise<Note[]> {
  return db.select(noteColumns).from(notes).where(ownNotes(userId, date)).orderBy(asc(notes.createdAt), asc(notes.id));
}

export const noteRoutes = new Hono<AppEnv>()
  .get("/", zValidator("query", z.object({ date: dateSchema }), validationHook), async (c) => {
    const { date } = c.req.valid("query");
    return c.json<Note[]>(await listNotes(c.get("db"), c.get("userId"), date));
  })
  .post("/", zValidator("json", createNoteRequestSchema, validationHook), async (c) => {
    const { date, body } = c.req.valid("json");
    const db = c.get("db");
    const userId = c.get("userId");
    const [{ total }] = await db.select({ total: count() }).from(notes).where(ownNotes(userId, date));
    if (total >= MAX_NOTES) {
      return c.json<ApiErrorBody>({ error: "invalid_request", message: `メモは 1 日 ${MAX_NOTES} 件までです` }, 400);
    }
    const [note] = await db.insert(notes).values({ userId, date, body, createdAt: Date.now() }).returning(noteColumns);
    return c.json<Note>(note, 201);
  })
  .delete(
    "/:id",
    zValidator("param", z.object({ id: z.coerce.number().int().positive() }), validationHook),
    async (c) => {
      const { id } = c.req.valid("param");
      // ほかのユーザーのメモの id を指定しても消さない
      await c
        .get("db")
        .delete(notes)
        .where(and(eq(notes.id, id), eq(notes.userId, c.get("userId"))));
      return c.body(null, 204);
    },
  );
