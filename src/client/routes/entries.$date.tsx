import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { DATE_PATTERN } from "../../shared/constants";
import { formatDate } from "../../shared/date";
import { EmptyState } from "../components/EmptyState";
import { EntryView } from "../components/EntryView";
import { ErrorMessage } from "../components/ErrorMessage";
import { Loading } from "../components/Loading";
import { useEntry } from "../lib/queries";

export const Route = createFileRoute("/entries/$date")({
  beforeLoad: ({ params }) => {
    if (!DATE_PATTERN.test(params.date)) throw notFound();
  },
  component: EntryPage,
});

function EntryPage() {
  const { date } = Route.useParams();
  const navigate = Route.useNavigate();
  const entry = useEntry(date);

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/entries"
        search={{ month: date.slice(0, 7) }}
        className="self-start text-sm text-muted-foreground hover:underline"
      >
        ← 一覧に戻る
      </Link>
      <h1 className="text-2xl font-bold">{formatDate(date)}</h1>
      {entry.isPending ? (
        <Loading />
      ) : entry.isError ? (
        <ErrorMessage error={entry.error} onRetry={() => entry.refetch()} />
      ) : entry.data ? (
        <EntryView
          detail={entry.data}
          onDeleted={() => navigate({ to: "/entries", search: { month: date.slice(0, 7) } })}
          onDateChanged={(newDate) => navigate({ to: "/entries/$date", params: { date: newDate }, replace: true })}
        />
      ) : (
        <EmptyState>この日の日記はありません</EmptyState>
      )}
    </div>
  );
}
