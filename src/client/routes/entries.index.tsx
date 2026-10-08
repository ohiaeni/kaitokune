import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MONTH_PATTERN, SEARCH_QUERY_MAX_LENGTH } from "../../shared/constants";
import type { EntrySummary } from "../../shared/schemas";
import { MonthCalendar } from "../components/MonthCalendar";
import { Button, ErrorMessage, Spinner } from "../components/ui";
import { api, queryKeys } from "../lib/api";
import { currentMonth, formatDate, formatMonth, shiftMonth } from "../lib/date";
import { moodEmoji } from "../lib/mood";
import { loadJson, saveJson } from "../lib/storage";

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

type View = "list" | "calendar";

const VIEWS: { value: View; label: string }[] = [
  { value: "list", label: "一覧" },
  { value: "calendar", label: "カレンダー" },
];
// 詳細画面から「一覧に戻る」で戻っても同じ表示になるよう、URL ではなく localStorage に持たせる
const VIEW_KEY = "kaitokune:entries-view";

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
      {q ? <SearchResults q={q} /> : <MonthEntries month={month ?? currentMonth()} />}
    </div>
  );
}

function SearchForm({ initial, onSearch }: { initial: string; onSearch: (q: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <search>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(value.trim());
        }}
      >
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={SEARCH_QUERY_MAX_LENGTH}
          placeholder="日記を検索"
          aria-label="日記を検索"
          className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 dark:border-stone-700 dark:bg-stone-900"
        />
        <Button type="submit" variant="secondary">
          検索
        </Button>
        {initial && (
          <Button variant="ghost" onClick={() => onSearch("")}>
            クリア
          </Button>
        )}
      </form>
    </search>
  );
}

function SearchResults({ q }: { q: string }) {
  const results = useQuery({ queryKey: queryKeys.entrySearch(q), queryFn: () => api.searchEntries(q) });

  if (results.isPending) return <Spinner label="検索中…" />;
  if (results.isError) return <ErrorMessage error={results.error} onRetry={() => results.refetch()} />;
  if (results.data.length === 0) {
    return <p className="py-10 text-center text-sm text-stone-500">「{q}」を含む日記は見つかりませんでした</p>;
  }
  return (
    <>
      <p className="text-sm text-stone-500">
        「{q}」を含む日記 {results.data.length} 件
      </p>
      <EntryList entries={results.data} highlight={q} />
    </>
  );
}

function MonthEntries({ month }: { month: string }) {
  const navigate = Route.useNavigate();
  const list = useQuery({ queryKey: queryKeys.entryList(month), queryFn: () => api.listEntries(month) });
  const isCurrent = month >= currentMonth();
  const [view, setView] = useState<View>(() => (loadJson<View>(VIEW_KEY) === "calendar" ? "calendar" : "list"));
  const changeView = (next: View) => {
    setView(next);
    saveJson(VIEW_KEY, next);
  };

  return (
    <>
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

      <fieldset className="flex self-center rounded-full bg-stone-200/60 p-1 dark:bg-stone-800">
        <legend className="sr-only">表示</legend>
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={view === v.value}
            onClick={() => changeView(v.value)}
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

function EntryList({ entries, highlight }: { entries: EntrySummary[]; highlight?: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((e) => (
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
            <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">
              {highlight ? <Highlight text={e.excerpt} q={highlight} /> : e.excerpt}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** 検索語に一致した部分を強調する（API の LIKE と同じく ASCII の大文字・小文字は区別しない） */
function Highlight({ text, q }: { text: string; q: string }) {
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"));
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: 同じテキストを分割しただけで、並びは固定
      <mark key={i} className="rounded bg-amber-200 px-0.5 text-inherit dark:bg-amber-700/60">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
