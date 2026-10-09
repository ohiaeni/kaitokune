import { foreignKey, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 日記を書ける人。ここに登録したメールアドレスだけが API を使える（Access のポリシーとは別に登録する）。
 * 登録・削除の手順は docs/setup.md を参照
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Access でログインするメールアドレス（小文字） */
  email: text("email").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

const userId = () =>
  integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

/** 日記は 1 人 1 日 1 件 */
export const entries = sqliteTable(
  "entries",
  {
    userId: userId(),
    date: text("date").notNull(),
    body: text("body").notNull(),
    mood: integer("mood"),
    /** 日記と一緒に AI が提案した「明日やってみること」（文字列の配列の JSON） */
    suggestions: text("suggestions", { mode: "json" }).$type<string[]>().notNull().default([]),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export const qaLogs = sqliteTable(
  "qa_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: userId(),
    entryDate: text("entry_date").notNull(),
    position: integer("position").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.userId, t.entryDate], foreignColumns: [entries.userId, entries.date] }).onDelete(
      "cascade",
    ),
    index("qa_logs_user_entry_date_idx").on(t.userId, t.entryDate),
  ],
);

/** AI の呼び出し回数。AI_DAILY_LIMIT はユーザーごとの上限 */
export const aiUsage = sqliteTable(
  "ai_usage",
  {
    userId: userId(),
    date: text("date").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

/** 日記を書く前にメモしておいた、その日の出来事や思ったこと。日記の生成で AI に渡す */
export const notes = sqliteTable(
  "notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: userId(),
    date: text("date").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("notes_user_date_idx").on(t.userId, t.date)],
);
