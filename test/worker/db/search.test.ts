import { describe, expect, it } from "vitest";
import { excerptAround, likePattern } from "../../../src/worker/db/search";

describe("likePattern", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(likePattern("カフェ")).toBe("%カフェ%");
    expect(likePattern("100%")).toBe("%100\\%%");
    expect(likePattern("e_c")).toBe("%e\\_c%");
    expect(likePattern("a\\b")).toBe("%a\\\\b%");
  });
});

describe("excerptAround", () => {
  it("returns the head of a short text as is", () => {
    expect(excerptAround("駅前のカフェ", "カフェ")).toBe("駅前のカフェ");
  });

  it("cuts out the text around the match with ellipses", () => {
    const text = `${"あ".repeat(40)}カフェに行った${"い".repeat(100)}`;
    expect(excerptAround(text, "カフェ")).toBe(`…${"あ".repeat(20)}カフェに行った${"い".repeat(53)}…`);
  });

  it("does not add an ellipsis at the start when the match is near the beginning", () => {
    const text = `カフェ${"い".repeat(100)}`;
    expect(excerptAround(text, "カフェ")).toBe(`カフェ${"い".repeat(77)}…`);
  });

  it("ignores ASCII case like LIKE does", () => {
    expect(excerptAround("Went to a CAFE", "cafe")).toBe("Went to a CAFE");
  });

  it("falls back to the head of the text when nothing matches", () => {
    expect(excerptAround("い".repeat(100), "カフェ")).toBe("い".repeat(80));
  });
});
