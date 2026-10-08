import { type EntriesView, useEntriesView } from "../../hooks/useEntriesView";
import { useEntryList } from "../../lib/queries";
import { MonthCalendar } from "../MonthCalendar";
import { EmptyState, ErrorMessage, SegmentedControl, Spinner } from "../ui";
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

      <SegmentedControl legend="表示" options={VIEWS} value={view} onChange={setView} />

      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorMessage error={list.error} onRetry={() => list.refetch()} />
      ) : view === "calendar" ? (
        <MonthCalendar month={month} entries={list.data} />
      ) : list.data.length === 0 ? (
        <EmptyState>この月の日記はまだありません</EmptyState>
      ) : (
        <EntryList entries={list.data} />
      )}
    </>
  );
}
