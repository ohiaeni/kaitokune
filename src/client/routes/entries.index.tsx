import { createFileRoute } from "@tanstack/react-router";
import { MONTH_PATTERN, SEARCH_QUERY_MAX_LENGTH } from "../../shared/constants";
import { MonthEntries } from "../components/entry-list/MonthEntries";
import { SearchForm } from "../components/entry-list/SearchForm";
import { SearchResults } from "../components/entry-list/SearchResults";
import { currentMonth } from "../lib/date";

export const Route = createFileRoute("/entries/")({
  validateSearch: (search: Record<string, unknown>): { month?: string; q?: string } => {
    const { month, q } = search;
    return {
      ...(typeof month === "string" && MONTH_PATTERN.test(month) ? { month } : {}),
      ...(typeof q === "string" && q.trim() ? { q: q.trim().slice(0, SEARCH_QUERY_MAX_LENGTH) } : {}),
    };
  },
  component: EntriesPage,
});

function EntriesPage() {
  const { month, q } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <SearchForm
        // 戻る操作で検索語が変わったときに入力欄を合わせる
        key={q ?? ""}
        initial={q ?? ""}
        onSearch={(next) => navigate({ search: (prev) => ({ month: prev.month, ...(next ? { q: next } : {}) }) })}
      />
      {q ? (
        <SearchResults q={q} />
      ) : (
        <MonthEntries month={month ?? currentMonth()} onMonthChange={(next) => navigate({ search: { month: next } })} />
      )}
    </div>
  );
}
