import { useEntrySearch } from "../../hooks/queries";
import { EmptyState } from "../common/EmptyState";
import { ErrorMessage } from "../common/ErrorMessage";
import { Loading } from "../common/Loading";
import { EntryList } from "./EntryList";

export function SearchResults({ q }: { q: string }) {
  const results = useEntrySearch(q);

  if (results.isPending) {
    return <Loading label="検索中…" />;
  }
  if (results.isError) {
    return <ErrorMessage error={results.error} onRetry={() => results.refetch()} />;
  }
  if (results.data.length === 0) {
    return <EmptyState>「{q}」を含む日記は見つかりませんでした</EmptyState>;
  }
  return (
    <>
      <p className="text-muted-foreground text-sm">
        「{q}」を含む日記 {results.data.length} 件
      </p>
      <EntryList entries={results.data} highlight={q} />
    </>
  );
}
