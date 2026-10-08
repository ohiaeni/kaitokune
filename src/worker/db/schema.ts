import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const entries = sqliteTable("entries", {
  date: text("date").primaryKey(),
  body: text("body").notNull(),
  mood: integer("mood"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const qaLogs = sqliteTable(
  "qa_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entryDate: text("entry_date")
      .notNull()
      .references(() => entries.date, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
  },
  (t) => [index("qa_logs_entry_date_idx").on(t.entryDate)],
);

export const aiUsage = sqliteTable("ai_usage", {
  date: text("date").primaryKey(),
  count: integer("count").notNull().default(0),
});

/** 日記を書く前にメモしておいた、その日の出来事や思ったこと。日記の生成で AI に渡す */
export const notes = sqliteTable(
  "notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("notes_date_idx").on(t.date)],
);
