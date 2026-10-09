import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

/** ユーザーを分ける前（v0.2.0）までのマイグレーション */
const BEFORE_USERS = ["0000_init.sql", "0001_notes.sql"];

describe("migrations", () => {
  it("assigns the existing data to the first user without losing anything", async () => {
    const db = env.MIGRATION_TEST_DB;
    const migrations = env.TEST_MIGRATIONS;
    await applyD1Migrations(
      db,
      migrations.filter((m) => BEFORE_USERS.includes(m.name)),
    );
    await db.batch([
      db.prepare("INSERT INTO entries VALUES ('2026-10-01', '一日目', 3, 1, 2), ('2026-10-02', '二日目', NULL, 3, 4)"),
      db.prepare(
        "INSERT INTO qa_logs (entry_date, position, question, answer) VALUES ('2026-10-01', 0, 'Q1', 'A1'), ('2026-10-01', 1, 'Q2', 'A2'), ('2026-10-02', 0, 'Q3', 'A3')",
      ),
      db.prepare("INSERT INTO ai_usage VALUES ('2026-10-01', 5)"),
      db.prepare("INSERT INTO notes (date, body, created_at) VALUES ('2026-10-01', 'メモ', 10)"),
    ]);

    await applyD1Migrations(db, migrations);

    const all = async (query: string) => (await db.prepare(query).all()).results;
    expect(await all("SELECT id, email FROM users")).toEqual([{ id: 1, email: "owner@example.invalid" }]);
    expect(await all("SELECT * FROM entries ORDER BY date")).toEqual([
      { user_id: 1, date: "2026-10-01", body: "一日目", mood: 3, suggestions: "[]", created_at: 1, updated_at: 2 },
      { user_id: 1, date: "2026-10-02", body: "二日目", mood: null, suggestions: "[]", created_at: 3, updated_at: 4 },
    ]);
    expect(await all("SELECT id, user_id, entry_date, position, question, answer FROM qa_logs ORDER BY id")).toEqual([
      { id: 1, user_id: 1, entry_date: "2026-10-01", position: 0, question: "Q1", answer: "A1" },
      { id: 2, user_id: 1, entry_date: "2026-10-01", position: 1, question: "Q2", answer: "A2" },
      { id: 3, user_id: 1, entry_date: "2026-10-02", position: 0, question: "Q3", answer: "A3" },
    ]);
    expect(await all("SELECT * FROM ai_usage")).toEqual([{ user_id: 1, date: "2026-10-01", count: 5 }]);
    expect(await all("SELECT * FROM notes")).toEqual([
      { id: 1, user_id: 1, date: "2026-10-01", body: "メモ", created_at: 10 },
    ]);
    expect(await all("SELECT name FROM sqlite_master WHERE name LIKE '__old_%'")).toEqual([]);
    expect(await all("PRAGMA foreign_key_check")).toEqual([]);

    // 会話ログは新しい entries を参照していて、日記を消すと一緒に消える
    await db.prepare("DELETE FROM entries WHERE date = '2026-10-01'").run();
    expect(await all("SELECT entry_date FROM qa_logs")).toEqual([{ entry_date: "2026-10-02" }]);
  });
});
