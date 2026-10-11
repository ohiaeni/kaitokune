import { Link } from "@tanstack/react-router";
import { findMood } from "../../../shared/constants";
import { formatDate, WEEKDAYS } from "../../../shared/date";
import type { EntrySummary } from "../../../shared/schemas";
import { calendarDays, today } from "../../lib/date";

/** 曜日の見出しの文字色（日曜は赤、土曜は青） */
function weekdayColor(index: number): string {
  if (index === 0) {
    return "text-red-600 dark:text-red-400";
  }
  if (index === 6) {
    return "text-sky-600 dark:text-sky-400";
  }
  return "text-muted-foreground";
}

/** 月のカレンダー。日記のある日には気分の絵文字を出し、押すと詳細画面に移る */
export function MonthCalendar({ month, entries }: { month: string; entries: EntrySummary[] }) {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const todayDate = today();

  return (
    <div className="grid grid-cols-7 gap-1 text-center">
      {WEEKDAYS.map((w, i) => (
        <div key={w} className={`pb-1 text-xs ${weekdayColor(i)}`}>
          {w}
        </div>
      ))}
      {calendarDays(month).map((date, i) => {
        if (!date) {
          // biome-ignore lint/suspicious/noArrayIndexKey: 月の前後の空きマスで、並びは固定
          return <div key={`blank-${i}`} aria-hidden />;
        }
        const day = Number(date.slice(8));
        const isToday = date === todayDate;
        const entry = byDate.get(date);
        const dayLabel = (
          <span
            className={`flex size-6 items-center justify-center rounded-full text-xs ${
              isToday ? "bg-primary font-bold text-primary-foreground" : ""
            }`}
          >
            {day}
          </span>
        );

        if (!entry) {
          return (
            <div
              key={date}
              className={`flex aspect-square flex-col items-center gap-0.5 rounded-xl p-1 ${date > todayDate ? "text-muted-foreground/40" : "text-muted-foreground"}`}
            >
              {dayLabel}
            </div>
          );
        }

        const mood = findMood(entry.mood);
        return (
          <Link
            key={date}
            to="/entries/$date"
            params={{ date }}
            aria-label={`${formatDate(date)}の日記${mood ? `（気分: ${mood.label}）` : ""}`}
            className="flex aspect-square flex-col items-center gap-0.5 rounded-xl border bg-card p-1 text-card-foreground transition hover:border-primary/60"
          >
            {dayLabel}
            <span className="text-lg leading-none sm:text-xl" aria-hidden>
              {mood?.emoji ?? "📝"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
