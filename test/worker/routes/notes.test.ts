import { beforeEach, describe, expect, it } from "vitest";
import type { ApiErrorBody, Note } from "../../../src/shared/schemas";
import { qa, resetDb, setup } from "../../helpers";

beforeEach(resetDb);
describe("/api/notes", () => {
  const addNote = (request: ReturnType<typeof setup>["request"], date: string, body: string) =>
    request("/api/notes", { method: "POST", json: { date, body } });

  it("adds, lists and deletes the notes of a day", async () => {
    const { request } = setup();
    const created = await addNote(request, "2026-10-08", "  昼にラーメン  ");
    expect(created.status).toBe(201);
    const note = await created.json<Note>();
    expect(note).toMatchObject({ date: "2026-10-08", body: "昼にラーメン" });
    await addNote(request, "2026-10-08", "夕方に雨");
    await addNote(request, "2026-10-07", "別の日");

    const list = async () => (await (await request("/api/notes?date=2026-10-08")).json<Note[]>()).map((n) => n.body);
    expect(await list()).toEqual(["昼にラーメン", "夕方に雨"]);

    expect((await request(`/api/notes/${note.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await list()).toEqual(["夕方に雨"]);
  });

  it("limits the number and length of notes", async () => {
    const { request } = setup();
    expect((await addNote(request, "2026-10-08", "あ".repeat(201))).status).toBe(400);
    expect((await addNote(request, "2026-10-08", "   ")).status).toBe(400);
    for (let i = 0; i < 20; i++) {
      expect((await addNote(request, "2026-10-08", `メモ${i}`)).status).toBe(201);
    }
    const over = await addNote(request, "2026-10-08", "21 件目");
    expect(over.status).toBe(400);
    expect((await over.json<ApiErrorBody>()).message).toContain("20 件");
    expect((await addNote(request, "2026-10-09", "別の日は追加できる")).status).toBe(201);
  });

  it("passes the day's notes to the AI when asking and composing", async () => {
    const { request, calls } = setup();
    await addNote(request, "2026-10-08", "昼にラーメン");
    await addNote(request, "2026-10-07", "別の日");

    await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: qa(1) } });
    await request("/api/chat/compose", { method: "POST", json: { date: "2026-10-08", qa: qa(1) } });
    expect(calls.next[0].notes).toEqual(["昼にラーメン"]);
    expect(calls.compose[0].notes).toEqual(["昼にラーメン"]);
  });
});
