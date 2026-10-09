// 日記（entries）と会話ログ（qa_logs）のデータアクセス。どの関数も userId で絞り込み、user_id は返さない
import { and, asc, desc, eq, exists, gte, inArray, lt, lte, or, type SQL } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { Entry, EntryDetail, EntrySummary, ExportFile, QA } from "../../shared/schemas";
import { entries, qaLogs } from "./schema";
import { contains, EXCERPT_LENGTH, excerptAround, likePattern } from "./search";

const LIST_LIMIT = 100;
const SEARCH_LIMIT = 50;

/** API で返す日記の列（user_id は返さない） */
const entryColumns = {
  date: entries.date,
  body: entries.body,
  mood: entries.mood,
  suggestions: entries.suggestions,
  createdAt: entries.createdAt,
  updatedAt: entries.updatedAt,
};

/** そのユーザーの日記を絞り込む条件 */
function ownEntry(userId: number, date: string): SQL | undefined {
  return and(eq(entries.userId, userId), eq(entries.date, date));
}

function ownQaLogs(userId: number, date: string): SQL | undefined {
  return and(eq(qaLogs.userId, userId), eq(qaLogs.entryDate, date));
}

/** 日記の一覧を新しい順に返す。month を指定すればその月だけ */
export async function listEntries(db: DrizzleD1Database, userId: number, month?: string): Promise<EntrySummary[]> {
  const rows = await db
    .select({ date: entries.date, body: entries.body, mood: entries.mood })
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        month ? and(gte(entries.date, `${month}-01`), lte(entries.date, `${month}-31`)) : undefined,
      ),
    )
    .orderBy(desc(entries.date))
    .limit(LIST_LIMIT);
  return rows.map((r) => ({ date: r.date, excerpt: r.body.slice(0, EXCERPT_LENGTH), mood: r.mood }));
}

/** 本文か会話ログに検索語を含む日記を新しい順に返す。抜粋は一致した箇所の前後 */
export async function searchEntries(db: DrizzleD1Database, userId: number, q: string): Promise<EntrySummary[]> {
  const pattern = likePattern(q);
  const qaMatches = and(
    eq(qaLogs.userId, entries.userId),
    eq(qaLogs.entryDate, entries.date),
    or(contains(qaLogs.question, pattern), contains(qaLogs.answer, pattern)),
  );
  const rows = await db
    .select({ date: entries.date, body: entries.body, mood: entries.mood })
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        or(contains(entries.body, pattern), exists(db.select({ id: qaLogs.id }).from(qaLogs).where(qaMatches))),
      ),
    )
    .orderBy(desc(entries.date))
    .limit(SEARCH_LIMIT);

  // 本文に一致しなかった日記は、一致した問答から抜粋を作る
  const lower = q.toLowerCase();
  const qaOnly = rows.filter((r) => !r.body.toLowerCase().includes(lower)).map((r) => r.date);
  const qaTexts = new Map<string, string>();
  if (qaOnly.length > 0) {
    const logs = await db
      .select({ date: qaLogs.entryDate, question: qaLogs.question, answer: qaLogs.answer })
      .from(qaLogs)
      .where(and(eq(qaLogs.userId, userId), inArray(qaLogs.entryDate, qaOnly)))
      .orderBy(asc(qaLogs.entryDate), asc(qaLogs.position));
    for (const log of logs) {
      if (qaTexts.has(log.date)) {
        continue;
      }
      if (log.answer.toLowerCase().includes(lower)) {
        qaTexts.set(log.date, log.answer);
      } else if (log.question.toLowerCase().includes(lower)) {
        qaTexts.set(log.date, log.question);
      }
    }
  }

  return rows.map((r) => ({
    date: r.date,
    excerpt: excerptAround(qaTexts.get(r.date) ?? r.body, q),
    mood: r.mood,
  }));
}

/** 日記と会話ログを返す。なければ null */
export async function getEntry(db: DrizzleD1Database, userId: number, date: string): Promise<EntryDetail | null> {
  const [entry] = await db.select(entryColumns).from(entries).where(ownEntry(userId, date));
  if (!entry) {
    return null;
  }
  const qa = await db
    .select({ question: qaLogs.question, answer: qaLogs.answer })
    .from(qaLogs)
    .where(ownQaLogs(userId, date))
    .orderBy(asc(qaLogs.position));
  return { entry, qa };
}

/**
 * 日記を作成・更新する。
 * qa・suggestions は渡したときだけ丸ごと入れ替える（本文だけの編集では既存の会話ログと提案を残す）
 */
export async function saveEntry(
  db: DrizzleD1Database,
  userId: number,
  date: string,
  { body, mood, qa, suggestions }: { body: string; mood: number | null; qa?: QA[]; suggestions?: string[] },
): Promise<Entry> {
  const now = Date.now();
  const upsert = db
    .insert(entries)
    .values({ userId, date, body, mood, suggestions, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [entries.userId, entries.date],
      set: { body, mood, ...(suggestions ? { suggestions } : {}), updatedAt: now },
    })
    .returning(entryColumns);

  if (!qa) {
    const [entry] = await upsert;
    return entry;
  }
  const deleteQa = db.delete(qaLogs).where(ownQaLogs(userId, date));
  const [[entry]] =
    qa.length > 0
      ? await db.batch([
          upsert,
          deleteQa,
          db.insert(qaLogs).values(qa.map((x, i) => ({ userId, entryDate: date, position: i, ...x }))),
        ])
      : await db.batch([upsert, deleteQa]);
  return entry;
}

/** 日記の日付を会話ログごと変える。日記がなければ not_found、変更先に日記があれば conflict */
export async function changeEntryDate(
  db: DrizzleD1Database,
  userId: number,
  date: string,
  newDate: string,
): Promise<{ status: "ok"; entry: Entry } | { status: "not_found" } | { status: "conflict" }> {
  const [entry] = await db.select(entryColumns).from(entries).where(ownEntry(userId, date));
  if (!entry) {
    return { status: "not_found" };
  }
  if (newDate === date) {
    return { status: "ok", entry };
  }
  const [existing] = await db.select({ date: entries.date }).from(entries).where(ownEntry(userId, newDate));
  if (existing) {
    return { status: "conflict" };
  }

  // (user_id, date) は主キーで qa_logs から参照されているため、新しい日付の行を作って会話ログを付け替えてから古い行を消す
  const [[moved]] = await db.batch([
    db
      .insert(entries)
      .values({ ...entry, userId, date: newDate, updatedAt: Date.now() })
      .returning(entryColumns),
    db.update(qaLogs).set({ entryDate: newDate }).where(ownQaLogs(userId, date)),
    db.delete(entries).where(ownEntry(userId, date)),
  ]);
  return { status: "ok", entry: moved };
}

/** 日記と会話ログを消す（なくても何もしない） */
export async function deleteEntry(db: DrizzleD1Database, userId: number, date: string): Promise<void> {
  await db.batch([db.delete(qaLogs).where(ownQaLogs(userId, date)), db.delete(entries).where(ownEntry(userId, date))]);
}

/** date より前の日記を新しい順に limit 件返す（AI に文脈として渡す） */
export function listRecentEntries(
  db: DrizzleD1Database,
  userId: number,
  date: string,
  limit: number,
): Promise<{ date: string; body: string }[]> {
  return db
    .select({ date: entries.date, body: entries.body })
    .from(entries)
    .where(and(eq(entries.userId, userId), lt(entries.date, date)))
    .orderBy(desc(entries.date))
    .limit(limit);
}

/** エクスポート用に、すべての日記を会話ログ付きで古い順に返す */
export async function loadAllForExport(db: DrizzleD1Database, userId: number): Promise<ExportFile["entries"]> {
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
