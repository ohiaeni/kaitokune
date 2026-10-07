import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MONTH_PATTERN } from "../../shared/constants";
import { Button, ErrorMessage, Spinner } from "../components/ui";
import { api, queryKeys } from "../lib/api";
import { currentMonth, formatDate, formatMonth, shiftMonth } from "../lib/date";
import { moodEmoji } from "../lib/mood";

export const Route = createFileRoute("/entries/")({
  validateSearch: (search: Record<string, unknown>): { month?: string } => {
    const month = search.month;
    return typeof month === "string" && MONTH_PATTERN.test(month) ? { month } : {};
  },
  component: EntriesPage,
});

function EntriesPage() {
  const month = Route.useSearch().month ?? currentMonth();
  const navigate = Route.useNavigate();
  const list = useQuery({ queryKey: queryKeys.entryList(month), queryFn: () => api.listEntries(month) });
  const isCurrent = month >= currentMonth();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          aria-label="前の月"
          onClick={() => navigate({ search: { month: shiftMonth(month, -1) } })}
        >
          ←
        </Button>
        <h1 className="text-xl font-bold">{formatMonth(month)}</h1>
        <Button
          variant="ghost"
          aria-label="次の月"
          disabled={isCurrent}
          onClick={() => navigate({ search: { month: shiftMonth(month, 1) } })}
        >
          →
        </Button>
      </div>

      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorMessage error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-500">この月の日記はまだありません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.data.map((e) => (
            <li key={e.date}>
              <Link
                to="/entries/$date"
                params={{ date: e.date }}
                className="block rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-amber-400 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-amber-600"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{formatDate(e.date)}</span>
                  <span className="text-xl" aria-hidden>
                    {moodEmoji(e.mood)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">{e.excerpt}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
