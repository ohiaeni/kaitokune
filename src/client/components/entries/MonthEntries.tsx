import { type EntriesView, useEntriesView } from "../../hooks/useEntriesView";
import { useEntryList } from "../../lib/queries";
import { EmptyState } from "../EmptyState";
import { ErrorMessage } from "../ErrorMessage";
import { Loading } from "../Loading";
import { MonthCalendar } from "../MonthCalendar";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
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

      <ToggleGroup
        type="single"
        spacing={1}
        aria-label="表示"
        value={view}
        // 選んでいるものをもう一度押すと空文字になるので、そのときは切り替えない
        onValueChange={(next) => next && setView(next as EntriesView)}
        className="self-center rounded-full bg-secondary p-1"
      >
        {VIEWS.map((v) => (
          <ToggleGroupItem
            key={v.value}
            value={v.value}
            size="sm"
            className="rounded-full px-4 font-normal text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-background data-[state=on]:font-medium data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          >
            {v.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {list.isPending ? (
        <Loading />
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
