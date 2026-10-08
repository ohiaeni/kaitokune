import { type EntriesView, useEntriesView } from "../../hooks/useEntriesView";
import { useEntryList } from "../../lib/queries";
import { MonthCalendar } from "../MonthCalendar";
import { ErrorMessage, Spinner } from "../ui";
import { EntryList } from "./EntryList";
import { MonthNav } from "./MonthNav";

const VIEWS: { value: EntriesView; label: string }[] = [
  { value: "list", label: "一覧" },
  { value: "calendar", label: "カレンダー" },
];

/** 月ごとの日記。一覧とカレンダーを切り替えられる */
export function MonthEntries({ month, onMonthChange }: { month: string; onMonthChange: (month: string) => void }) {
  const list = useEntryList(month);
  const [view, setView] = useEntriesView();

  return (
    <>
      <MonthNav month={month} onChange={onMonthChange} />

      <fieldset className="flex self-center rounded-full bg-stone-200/60 p-1 dark:bg-stone-800">
        <legend className="sr-only">表示</legend>
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={view === v.value}
            onClick={() => setView(v.value)}
            className={`rounded-full px-4 py-1 text-sm transition ${
              view === v.value
                ? "bg-white font-medium text-stone-900 shadow-sm dark:bg-stone-950 dark:text-stone-50"
                : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            }`}
          >
            {v.label}
          </button>
        ))}
      </fieldset>

      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorMessage error={list.error} onRetry={() => list.refetch()} />
      ) : view === "calendar" ? (
        <MonthCalendar month={month} entries={list.data} />
      ) : list.data.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-500">この月の日記はまだありません</p>
      ) : (
        <EntryList entries={list.data} />
      )}
    </>
  );
}
