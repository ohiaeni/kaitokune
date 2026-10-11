import { beforeEach, describe, expect, it } from "vitest";
import type { EntryDetail, EntrySummary, ExportFile, Note, UsageResponse } from "../../../src/shared/schemas";
import { qa, registerUser, resetDb, setup } from "../../helpers";

beforeEach(resetDb);
describe("user isolation", () => {
  const OTHER = "other@example.invalid";

  beforeEach(async () => {
    await registerUser(OTHER);
  });

  /** 自分（id=1）が日記・会話ログ・メモを持っている状態にする */
  async function seedOwner() {
    const owner = setup();
    await owner.request("/api/entries/2026-10-07", { method: "PUT", json: { body: "自分の秘密の日記", qa: qa(2) } });
    const note = await (
      await owner.request("/api/notes", { method: "POST", json: { date: "2026-10-08", body: "自分のメモ" } })
    ).json<Note>();
    return { owner, note };
  }

  it("does not show other users' entries, search results, notes or exports", async () => {
    await seedOwner();
    const other = setup({}, { DEV_USER_EMAIL: OTHER });

    expect(await (await other.request("/api/entries")).json()).toEqual([]);
    expect(await (await other.request("/api/entries?month=2026-10")).json()).toEqual([]);
    expect(await (await other.request("/api/entries?q=秘密")).json()).toEqual([]);
    expect(await (await other.request("/api/entries?q=回答1")).json()).toEqual([]);
    expect((await other.request("/api/entries/2026-10-07")).status).toBe(404);
    expect(await (await other.request("/api/notes?date=2026-10-08")).json()).toEqual([]);
    expect((await (await other.request("/api/export?format=json")).json<ExportFile>()).entries).toEqual([]);
    expect(await (await other.request("/api/export?format=markdown")).text()).not.toContain("秘密");
  });

  it("does not let other users change or delete someone else's data", async () => {
    const { owner, note } = await seedOwner();
    const other = setup({}, { DEV_USER_EMAIL: OTHER });

    const patch = await other.request("/api/entries/2026-10-07", { method: "PATCH", json: { date: "2026-10-01" } });
    expect(patch.status).toBe(404);
    expect((await other.request("/api/entries/2026-10-07", { method: "DELETE" })).status).toBe(204);
    expect((await other.request(`/api/notes/${note.id}`, { method: "DELETE" })).status).toBe(204);

    const detail = await (await owner.request("/api/entries/2026-10-07")).json<EntryDetail>();
    expect(detail.entry.body).toBe("自分の秘密の日記");
    expect(detail.qa).toEqual(qa(2));
    expect(await (await owner.request("/api/notes?date=2026-10-08")).json<Note[]>()).toHaveLength(1);
  });

  it("lets each user keep their own entry for the same date", async () => {
    const { owner } = await seedOwner();
    const other = setup({}, { DEV_USER_EMAIL: OTHER });

    const res = await other.request("/api/entries/2026-10-07", {
      method: "PUT",
      json: { body: "相手の日記", qa: qa(1) },
    });
    expect(res.status).toBe(200);
    // 日付の変更での重複チェックもユーザーごと
    await other.request("/api/entries/2026-10-05", { method: "PUT", json: { body: "相手の別の日記" } });
    const moved = await other.request("/api/entries/2026-10-05", { method: "PATCH", json: { date: "2026-10-03" } });
    expect(moved.status).toBe(200);

    expect((await (await owner.request("/api/entries/2026-10-07")).json<EntryDetail>()).entry.body).toBe(
      "自分の秘密の日記",
    );
    const theirs = await (await other.request("/api/entries/2026-10-07")).json<EntryDetail>();
    expect(theirs).toEqual({ entry: expect.objectContaining({ body: "相手の日記" }), qa: qa(1) });
    expect((await (await owner.request("/api/entries")).json<EntrySummary[]>()).map((e) => e.date)).toEqual([
      "2026-10-07",
    ]);

    // 自分が日記を消しても、相手の同じ日付の日記と会話ログは残る
    await owner.request("/api/entries/2026-10-07", { method: "DELETE" });
    expect(await (await other.request("/api/entries/2026-10-07")).json<EntryDetail>()).toEqual(theirs);
  });

  it("does not pass other users' entries or notes to the AI", async () => {
    await seedOwner();
    const other = setup({}, { DEV_USER_EMAIL: OTHER });

    await other.request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: [] } });
    await other.request("/api/chat/compose", { method: "POST", json: { date: "2026-10-08", qa: qa(1) } });
    expect(other.calls.next[0]).toMatchObject({ recent: [], notes: [] });
    expect(other.calls.compose[0]).toMatchObject({ notes: [] });
  });

  it("counts the daily AI limit per user", async () => {
    const owner = setup({}, { AI_DAILY_LIMIT: "1" });
    const other = setup({}, { AI_DAILY_LIMIT: "1", DEV_USER_EMAIL: OTHER });
    const next = (user: typeof owner) =>
      user.request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: [] } });

    expect((await next(owner)).status).toBe(200);
    expect((await next(owner)).status).toBe(429);
    // 自分が上限に達しても、相手はまだ使える
    expect((await next(other)).status).toBe(200);
    expect((await next(other)).status).toBe(429);

    const usage = await (await other.request("/api/usage")).json<UsageResponse>();
    expect(usage.ai.today).toEqual({ used: 1, limit: 1 });
    expect(usage.ai.history).toHaveLength(1);
  });

  it("does not include the user id in responses", async () => {
    const { owner, note } = await seedOwner();
    const detail = await (await owner.request("/api/entries/2026-10-07")).json<EntryDetail>();
    const saved = await (await owner.request("/api/entries/2026-10-07", { method: "PUT", json: { body: "x" } })).json();
    const file = await (await owner.request("/api/export?format=json")).json<ExportFile>();
    for (const value of [detail.entry, saved, file.entries[0], note]) {
      expect(Object.keys(value as object)).not.toContain("userId");
    }
  });
});
