import { describe, expect, it } from "vitest";
import { calendarDays } from "../../../src/client/lib/date";

describe("calendarDays", () => {
  it("pads the month to whole weeks starting on Sunday", () => {
    // 2026-10-01 は木曜日
    const cells = calendarDays("2026-10");
    expect(cells).toHaveLength(35);
    expect(cells.slice(0, 5)).toEqual([null, null, null, null, "2026-10-01"]);
    expect(cells.at(-1)).toBe("2026-10-31");
  });

  it("handles leap years", () => {
    // 2028-02-01 は火曜日。うるう年なので 29 日まである
    const cells = calendarDays("2028-02");
    expect(cells.filter(Boolean)).toHaveLength(29);
    expect(cells[2]).toBe("2028-02-01");
    expect(cells).toHaveLength(35);
    expect(cells.slice(-4)).toEqual([null, null, null, null]);
  });
});
