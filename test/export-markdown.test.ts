import { describe, expect, it } from "vitest";
import type { ExportFile } from "../src/shared/schemas";
import { toMarkdown } from "../src/worker/export/markdown";

const entry = (date: string, body: string, mood: number | null, qa: ExportFile["entries"][number]["qa"] = []) => ({
  date,
  body,
  mood,
  createdAt: 0,
  updatedAt: 0,
  qa,
});

describe("toMarkdown", () => {
  it("lists each day with its mood, body and folded conversation", () => {
    const file: ExportFile = {
      format: "kaitokune",
      version: 1,
      exportedAt: "2026-10-08T12:00:00.000Z",
      entries: [
        entry("2026-10-07", "一日目", null),
        entry("2026-10-08", "二日目", 4, [
          { question: "質問1", answer: "回答1" },
          { question: "質問2", answer: "回答2" },
        ]),
      ],
    };
    expect(toMarkdown(file)).toBe(
      [
        "# kaitokune の日記",
        // 見出しのあとの空行は 3 行（分割前の出力に合わせている）
        "",
        "",
        "",
        "2026-10-08T12:00:00.000Z にエクスポート（2 件）",
        "",
        "## 2026年10月7日（水）",
        "",
        "一日目",
        "",
        "## 2026年10月8日（木）",
        "",
        "気分: 🙂 よい",
        "",
        "二日目",
        "",
        "<details>",
        "<summary>AI との会話</summary>",
        "",
        "**Q. 質問1**",
        "",
        "A. 回答1",
        "",
        "**Q. 質問2**",
        "",
        "A. 回答2",
        "",
        "</details>",
        "",
      ].join("\n"),
    );
  });

  it("writes only the header when there are no entries", () => {
    const file: ExportFile = { format: "kaitokune", version: 1, exportedAt: "2026-10-08T12:00:00.000Z", entries: [] };
    expect(toMarkdown(file)).toBe("# kaitokune の日記\n\n\n\n2026-10-08T12:00:00.000Z にエクスポート（0 件）\n");
  });
});
