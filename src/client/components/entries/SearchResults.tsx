import { useEntrySearch } from "../../lib/queries";
import { ErrorMessage, Spinner } from "../ui";
import { EntryList } from "./EntryList";

export function SearchResults({ q }: { q: string }) {
  const results = useEntrySearch(q);

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
