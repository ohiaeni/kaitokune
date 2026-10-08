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

/** "2026-10" → "2026年10月" */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

/**
 * 月のカレンダーのマス目（日曜始まり）。月の前後の空きマスは null で埋め、7 の倍数にそろえる
 * "2026-10" → [null, null, null, null, "2026-10-01", …, "2026-10-31"]
 */
export function calendarDays(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const leading = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let d = 1; d <= days; d++) {
    cells.push(`${month}-${pad(d)}`);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
