// 日付（YYYY-MM-DD）の表示。クライアントと Worker（エクスポート）で同じ表示にする

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** "2026-10-08" の曜日（0 = 日曜）。実行環境のタイムゾーンに左右されないよう UTC で計算する */
function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "2026-10-08" → "10月8日（木）"。withYear なら "2026年10月8日（木）" */
export function formatDate(date: string, { withYear = false }: { withYear?: boolean } = {}): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${withYear ? `${y}年` : ""}${m}月${d}日（${WEEKDAYS[weekdayOf(date)]}）`;
}

/** 指定タイムゾーンでの今日の日付（YYYY-MM-DD） */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
