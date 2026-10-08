import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { EntryView } from "../components/EntryView";
import { Interview } from "../components/Interview";
import { ErrorMessage, Spinner } from "../components/ui";
import { api, queryKeys } from "../lib/api";
import { formatDate, today } from "../lib/date";

export const Route = createFileRoute("/")({ component: TodayPage });

function TodayPage() {
  // 開いたときの日付で固定する（日付をまたいでも書きかけの会話が別の日に移らないように）
  const [date] = useState(today);
  const entry = useQuery({ queryKey: queryKeys.entry(date), queryFn: () => api.getEntry(date) });
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">
        {formatDate(date)}
        <span className="ml-2 text-base font-normal text-stone-500">今日の日記</span>
      </h1>
      {entry.isPending ? (
        <Spinner />
      ) : entry.isError ? (
        <ErrorMessage error={entry.error} onRetry={() => entry.refetch()} />
      ) : entry.data ? (
        <EntryView
          detail={entry.data}
          onDateChanged={(newDate) => navigate({ to: "/entries/$date", params: { date: newDate } })}
        />
      ) : (
        <Interview date={date} />
      )}
    </div>
  );
}
