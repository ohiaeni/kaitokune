import { type SQL, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

/** 抜粋の最大文字数 */
export const EXCERPT_LENGTH = 80;
/** 検索結果の抜粋で、一致した箇所より前に残す文字数 */
const SEARCH_CONTEXT = 20;

/** LIKE の特殊文字（% と _、エスケープ文字の \）をエスケープし、部分一致のパターンにする */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

/** likePattern で作ったパターンに一致する条件 */
export function contains(column: SQLiteColumn, pattern: string): SQL {
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}

/** 一致した箇所の前後を切り出す。LIKE と同じく ASCII の大文字・小文字は区別しない */
export function excerptAround(text: string, q: string): string {
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index < 0) return text.slice(0, EXCERPT_LENGTH);
  const start = Math.max(0, index - SEARCH_CONTEXT);
  const end = start + EXCERPT_LENGTH;
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
