import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorMessage } from "./ErrorMessage";
import { Loading } from "./Loading";

/** クエリの結果に応じて、読み込み中・エラー（再試行ボタン付き）・取得したデータの表示を切り替える */
export function QueryResult<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isPending) {
    return <Loading />;
  }
  if (query.isError) {
    return <ErrorMessage error={query.error} onRetry={() => query.refetch()} />;
  }
  return children(query.data);
}
