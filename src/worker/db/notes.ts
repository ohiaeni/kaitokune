// メモ（notes）のデータアクセス。どの関数も userId で絞り込み、user_id は返さない
import { and, asc, count, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { Note } from "../../shared/schemas";
import { notes } from "./schema";

/** API で返すメモの列（user_id は返さない） */
const noteColumns = { id: notes.id, date: notes.date, body: notes.body, createdAt: notes.createdAt };

const ownNotes = (userId: number, date: string) => and(eq(notes.userId, userId), eq(notes.date, date));

/** その日のメモを書いた順に返す */
export function listNotes(db: DrizzleD1Database, userId: number, date: string): Promise<Note[]> {
  return db.select(noteColumns).from(notes).where(ownNotes(userId, date)).orderBy(asc(notes.createdAt), asc(notes.id));
}

/** その日のメモの件数 */
export async function countNotes(db: DrizzleD1Database, userId: number, date: string): Promise<number> {
  const [{ total }] = await db.select({ total: count() }).from(notes).where(ownNotes(userId, date));
  return total;
}

export async function createNote(db: DrizzleD1Database, userId: number, date: string, body: string): Promise<Note> {
  const [note] = await db.insert(notes).values({ userId, date, body, createdAt: Date.now() }).returning(noteColumns);
  return note;
}

/** メモを消す。ほかのユーザーのメモの id を指定しても消さない */
export async function deleteNote(db: DrizzleD1Database, userId: number, id: number): Promise<void> {
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
}
