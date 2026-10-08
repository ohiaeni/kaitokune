import { type EntriesView, useEntriesView } from "../../hooks/useEntriesView";
import { useEntryList } from "../../lib/queries";
import { MonthCalendar } from "../MonthCalendar";
import { EmptyState, QueryResult, SegmentedControl } from "../ui";
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

      <QueryResult query={list}>
        {(entries) => {
          if (view === "calendar") {
            return <MonthCalendar month={month} entries={entries} />;
          }
          if (entries.length === 0) {
            return <EmptyState>この月の日記はまだありません</EmptyState>;
          }
          return <EntryList entries={entries} />;
        }}
      </QueryResult>
    </>
  );
}
