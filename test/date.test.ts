import { describe, expect, it } from "vitest";
import { calendarDays } from "../src/client/lib/date";
import { formatDate, todayIn } from "../src/shared/date";

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

describe("formatDate", () => {
  it("formats a date with the weekday, optionally with the year", () => {
    expect(formatDate("2026-10-08")).toBe("10月8日（木）");
    expect(formatDate("2026-10-08", { withYear: true })).toBe("2026年10月8日（木）");
    expect(formatDate("2028-02-29")).toBe("2月29日（火）");
    expect(formatDate("2026-10-04")).toBe("10月4日（日）");
  });
});

describe("todayIn", () => {
  it("returns today's date in the given time zone", () => {
    // 2026-10-07 15:30 UTC は、日本では 10 月 8 日の 0:30
    const now = new Date("2026-10-07T15:30:00Z");
    expect(todayIn("UTC", now)).toBe("2026-10-07");
    expect(todayIn("Asia/Tokyo", now)).toBe("2026-10-08");
  });
});
