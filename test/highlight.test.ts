import { describe, expect, it } from "vitest";
import { splitByQuery } from "../src/client/lib/highlight";

describe("splitByQuery", () => {
  it("splits the text into matched and unmatched parts", () => {
    expect(splitByQuery("駅前のカフェでカフェラテ", "カフェ")).toEqual([
      { text: "駅前の", match: false },
      { text: "カフェ", match: true },
      { text: "で", match: false },
      { text: "カフェ", match: true },
      { text: "ラテ", match: false },
    ]);
  });

  it("ignores ASCII case and keeps the original text", () => {
    expect(splitByQuery("Cafe and CAFE", "cafe")).toEqual([
      { text: "Cafe", match: true },
      { text: " and ", match: false },
      { text: "CAFE", match: true },
    ]);
  });

  it("treats regular expression characters in the query literally", () => {
    expect(splitByQuery("a.b axb (c)", "a.b")).toEqual([
      { text: "a.b", match: true },
      { text: " axb (c)", match: false },
    ]);
    expect(splitByQuery("100% (c)", "(c)")).toEqual([
      { text: "100% ", match: false },
      { text: "(c)", match: true },
    ]);
  });

  it("returns the whole text when nothing matches", () => {
    expect(splitByQuery("日記", "カフェ")).toEqual([{ text: "日記", match: false }]);
  });
});
