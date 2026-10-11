import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { ApiErrorBody, Entry, EntryDetail, EntrySummary } from "../../../src/shared/schemas";
import { qa, resetDb, setup } from "../../helpers";

beforeEach(resetDb);
describe("/api/entries", () => {
  it("saves an entry with its conversation and reads it back", async () => {
    const { request } = setup();
    const put = await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文", mood: 4, qa: qa(3) } });
    expect(put.status).toBe(200);
    expect((await put.json<Entry>()).mood).toBe(4);

    const detail = await (await request("/api/entries/2026-10-08")).json<EntryDetail>();
    expect(detail.entry.body).toBe("本文");
    expect(detail.qa).toEqual(qa(3));
  });

  it("keeps the conversation log when only the body is edited", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文", qa: qa(3) } });
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "書き直した本文", mood: 2 } });

    const detail = await (await request("/api/entries/2026-10-08")).json<EntryDetail>();
    expect(detail.entry.body).toBe("書き直した本文");
    expect(detail.entry.mood).toBe(2);
    expect(detail.entry.createdAt).toBeLessThanOrEqual(detail.entry.updatedAt);
    expect(detail.qa).toHaveLength(3);
  });

  it("saves the suggestions and keeps them when only the body is edited", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-08", {
      method: "PUT",
      json: { body: "本文", qa: qa(3), suggestions: ["散歩する", "早く寝る"] },
    });
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "書き直した本文" } });
    const detail = await (await request("/api/entries/2026-10-08")).json<EntryDetail>();
    expect(detail.entry.suggestions).toEqual(["散歩する", "早く寝る"]);

    // 日付を変えても提案は残る
    await request("/api/entries/2026-10-08", { method: "PATCH", json: { date: "2026-10-07" } });
    const moved = await (await request("/api/entries/2026-10-07")).json<EntryDetail>();
    expect(moved.entry.suggestions).toEqual(["散歩する", "早く寝る"]);
  });

  it("returns no suggestions for an entry saved without them", async () => {
    const { request } = setup();
    const put = await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文" } });
    expect((await put.json<Entry>()).suggestions).toEqual([]);
  });

  it("rejects too many or too long suggestions", async () => {
    const { request } = setup();
    const save = (suggestions: string[]) =>
      request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文", suggestions } });
    expect((await save(["a", "b", "c", "d"])).status).toBe(400);
    expect((await save(["a".repeat(101)])).status).toBe(400);
  });

  it("lists entries for a month, newest first", async () => {
    const { request } = setup();
    for (const date of ["2026-09-30", "2026-10-01", "2026-10-15"]) {
      await request(`/api/entries/${date}`, { method: "PUT", json: { body: `${date} の日記` } });
    }
    const list = await (await request("/api/entries?month=2026-10")).json<EntrySummary[]>();
    expect(list.map((e) => e.date)).toEqual(["2026-10-15", "2026-10-01"]);
    expect(list[0].excerpt).toBe("2026-10-15 の日記");
  });

  it("searches entries by keyword in the body and the conversation, newest first", async () => {
    const { request } = setup();
    const long = `${"あ".repeat(40)}カフェに行った${"い".repeat(100)}`;
    await request("/api/entries/2026-09-01", { method: "PUT", json: { body: long } });
    await request("/api/entries/2026-10-01", {
      method: "PUT",
      json: { body: "家で過ごした", qa: [{ question: "どこへ？", answer: "駅前のカフェ" }] },
    });
    await request("/api/entries/2026-10-02", { method: "PUT", json: { body: "関係ない日" } });
    const search = async (q: string) =>
      (await request(`/api/entries?q=${encodeURIComponent(q)}`)).json<EntrySummary[]>();

    const results = await search("カフェ");
    expect(results.map((e) => e.date)).toEqual(["2026-10-01", "2026-09-01"]);
    // 本文に一致しなければ問答から、本文が長ければ一致した箇所の前後を抜粋する
    expect(results[0].excerpt).toBe("駅前のカフェ");
    expect(results[1].excerpt).toBe(`…${"あ".repeat(20)}カフェに行った${"い".repeat(53)}…`);

    expect(await search("見つからない")).toEqual([]);
  });

  it("treats LIKE wildcards in the keyword literally", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-01", { method: "PUT", json: { body: "達成率は 100% だった" } });
    await request("/api/entries/2026-10-02", { method: "PUT", json: { body: "snake_case と書いた" } });
    // cspell:ignore snakeXcase -- "_" が任意の 1 文字に当たらないことを確かめるための綴り
    await request("/api/entries/2026-10-03", { method: "PUT", json: { body: "10 回 snakeXcase" } });
    const search = async (q: string) =>
      (await (await request(`/api/entries?q=${encodeURIComponent(q)}`)).json<EntrySummary[]>()).map((e) => e.date);

    expect(await search("%")).toEqual(["2026-10-01"]);
    expect(await search("e_c")).toEqual(["2026-10-02"]);
    expect(await search("\\")).toEqual([]);
  });

  it("rejects an empty or too long keyword", async () => {
    const { request } = setup();
    expect((await request("/api/entries?q=")).status).toBe(400);
    expect((await request(`/api/entries?q=${"a".repeat(51)}`)).status).toBe(400);
  });

  it("deletes an entry and its conversation", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文", qa: qa(2) } });
    expect((await request("/api/entries/2026-10-08", { method: "DELETE" })).status).toBe(204);
    expect((await request("/api/entries/2026-10-08")).status).toBe(404);
    const { count } = (await env.DB.prepare("SELECT COUNT(*) AS count FROM qa_logs").first<{ count: number }>()) ?? {};
    expect(count).toBe(0);
  });

  it("changes the date of an entry together with its conversation", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文", mood: 3, qa: qa(2) } });

    const res = await request("/api/entries/2026-10-08", { method: "PATCH", json: { date: "2026-10-07" } });
    expect(res.status).toBe(200);
    expect(await res.json<Entry>()).toMatchObject({ date: "2026-10-07", body: "本文", mood: 3 });

    expect((await request("/api/entries/2026-10-08")).status).toBe(404);
    const detail = await (await request("/api/entries/2026-10-07")).json<EntryDetail>();
    expect(detail.entry.body).toBe("本文");
    expect(detail.qa).toEqual(qa(2));
  });

  it("refuses to change the date onto an existing entry, a future date, or a missing entry", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-07", { method: "PUT", json: { body: "前日", qa: qa(1) } });
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "当日" } });
    const patch = (from: string, to: string) =>
      request(`/api/entries/${from}`, { method: "PATCH", json: { date: to } });

    const conflict = await patch("2026-10-08", "2026-10-07");
    expect(conflict.status).toBe(409);
    expect((await conflict.json<ApiErrorBody>()).error).toBe("conflict");
    const kept = await (await request("/api/entries/2026-10-07")).json<EntryDetail>();
    expect(kept.entry.body).toBe("前日");
    expect(kept.qa).toEqual(qa(1));

    expect((await patch("2026-10-08", "2999-01-01")).status).toBe(400);
    expect((await patch("2026-10-01", "2026-09-30")).status).toBe(404);
    expect((await patch("2026-10-08", "2026/10/06")).status).toBe(400);
  });

  it("rejects an invalid date or mood", async () => {
    const { request } = setup();
    expect((await request("/api/entries/not-a-date")).status).toBe(400);
    const res = await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文", mood: 9 } });
    expect(res.status).toBe(400);
  });
});
