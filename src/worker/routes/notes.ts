import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { type ApiErrorBody, createNoteRequestSchema, dateSchema, MAX_NOTES, type Note } from "../../shared/schemas";
import { countNotes, createNote, deleteNote, listNotes } from "../db/notes";
import { validationHook } from "../lib/validation";
import type { AppEnv } from "../types";

export const noteRoutes = new Hono<AppEnv>()
  .get("/", zValidator("query", z.object({ date: dateSchema }), validationHook), async (c) => {
    const { date } = c.req.valid("query");
    return c.json<Note[]>(await listNotes(c.get("db"), c.get("userId"), date));
  })
  .post("/", zValidator("json", createNoteRequestSchema, validationHook), async (c) => {
    const { date, body } = c.req.valid("json");
    const db = c.get("db");
    const userId = c.get("userId");
    if ((await countNotes(db, userId, date)) >= MAX_NOTES) {
      return c.json<ApiErrorBody>({ error: "invalid_request", message: `メモは 1 日 ${MAX_NOTES} 件までです` }, 400);
    }
    return c.json<Note>(await createNote(db, userId, date, body), 201);
  })
  .delete(
    "/:id",
    zValidator("param", z.object({ id: z.coerce.number().int().positive() }), validationHook),
    async (c) => {
      const { id } = c.req.valid("param");
      await deleteNote(c.get("db"), c.get("userId"), id);
      return c.body(null, 204);
    },
  );
