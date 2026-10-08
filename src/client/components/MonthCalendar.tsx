import { Link } from "@tanstack/react-router";
import type { EntrySummary } from "../../shared/schemas";
import { calendarDays, formatDate, today, WEEKDAYS } from "../lib/date";
import { MOODS } from "../lib/mood";

/** 月のカレンダー。日記のある日には気分の絵文字を出し、押すと詳細画面に移る */
export function MonthCalendar({ month, entries }: { month: string; entries: EntrySummary[] }) {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const todayDate = today();

  return (
    <div className="grid grid-cols-7 gap-1 text-center">
      {WEEKDAYS.map((w, i) => (
        <div
          key={w}
          className={`pb-1 text-xs ${i === 0 ? "text-red-600 dark:text-red-400" : i === 6 ? "text-sky-600 dark:text-sky-400" : "text-stone-500"}`}
        >
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
              isToday ? "bg-amber-600 font-bold text-white dark:bg-amber-500 dark:text-stone-950" : ""
            }`}
          >
            {day}
          </span>
        );

        if (!entry) {
          return (
            <div
              key={date}
              className={`flex aspect-square flex-col items-center gap-0.5 rounded-xl p-1 ${date > todayDate ? "text-stone-300 dark:text-stone-700" : "text-stone-500"}`}
            >
              {dayLabel}
            </div>
          );
        }

        const mood = MOODS.find((m) => m.value === entry.mood);
        return (
          <Link
            key={date}
            to="/entries/$date"
            params={{ date }}
            aria-label={`${formatDate(date)}の日記${mood ? `（気分: ${mood.label}）` : ""}`}
            className="flex aspect-square flex-col items-center gap-0.5 rounded-xl border border-stone-200 bg-white p-1 transition hover:border-amber-400 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-amber-600"
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
