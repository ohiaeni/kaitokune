const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 端末のローカル時刻での今日（YYYY-MM-DD） */
export function today(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentMonth(now = new Date()): string {
  return today(now).slice(0, 7);
}

/** "2026-10-08" → "10月8日（木）" */
export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${m}月${d}日（${WEEKDAYS[new Date(y, m - 1, d).getDay()]}）`;
}

/** "2026-10" → "2026年10月" */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
