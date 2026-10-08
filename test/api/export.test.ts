import { beforeEach, describe, expect, it } from "vitest";
import type { ExportFile } from "../../src/shared/schemas";
import { qa, resetDb, setup } from "../helpers";

beforeEach(resetDb);
describe("GET /api/export", () => {
  it("exports every entry with its conversation as JSON", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "二日目", mood: 5, qa: qa(2) } });
    await request("/api/entries/2026-10-07", { method: "PUT", json: { body: "一日目" } });

    const res = await request("/api/export?format=json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="kaitokune-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    const file = await res.json<ExportFile>();
    expect(file).toMatchObject({ format: "kaitokune", version: 1 });
    expect(file.entries.map((e) => [e.date, e.body, e.mood, e.qa])).toEqual([
      ["2026-10-07", "一日目", null, []],
      ["2026-10-08", "二日目", 5, qa(2)],
    ]);
    expect(file.entries[0].createdAt).toEqual(expect.any(Number));
  });

  it("exports a readable Markdown file", async () => {
    const { request } = setup();
    await request("/api/entries/2026-10-08", { method: "PUT", json: { body: "本文です", mood: 4, qa: qa(1) } });

    const res = await request("/api/export?format=markdown");
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(/\.md"$/);
    const text = await res.text();
    expect(text).toContain("（1 件）");
    expect(text).toContain("## 2026年10月8日（木）\n\n気分: 🙂 よい\n\n本文です\n\n<details>");
    expect(text).toContain("**Q. 質問1**\n\nA. 回答1");
  });

  it("rejects an unknown format", async () => {
    const { request } = setup();
    expect((await request("/api/export?format=csv")).status).toBe(400);
  });
});
