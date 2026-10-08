import { Link } from "@tanstack/react-router";
import { findMood } from "../../../shared/constants";
import { formatDate } from "../../../shared/date";
import type { EntrySummary } from "../../../shared/schemas";
import { splitByQuery } from "../../lib/highlight";

/** 日記の一覧。highlight を渡すと、抜粋の中の検索語を強調する */
export function EntryList({ entries, highlight }: { entries: EntrySummary[]; highlight?: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((e) => (
        <li key={e.date}>
          <Link
            to="/entries/$date"
            params={{ date: e.date }}
            className="block rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition hover:border-primary/60"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{formatDate(e.date)}</span>
              <span className="text-xl" aria-hidden>
                {findMood(e.mood)?.emoji}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {highlight ? <Highlight text={e.excerpt} q={highlight} /> : e.excerpt}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  return splitByQuery(text, q).map((part, i) =>
    part.match ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: 同じテキストを分割しただけで、並びは固定
      <mark key={i} className="rounded bg-amber-200 px-0.5 text-inherit dark:bg-amber-700/60">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}
