import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { formatDate } from "../../shared/date";
import { EntryView } from "../components/EntryView";
import { ErrorMessage } from "../components/ErrorMessage";
import { Interview } from "../components/Interview";
import { Loading } from "../components/Loading";
import { NotesPanel } from "../components/NotesPanel";
import { today } from "../lib/date";
import { useEntry } from "../lib/queries";

export const Route = createFileRoute("/")({ component: TodayPage });

function TodayPage() {
  // 開いたときの日付で固定する（日付をまたいでも書きかけの会話が別の日に移らないように）
  const [date] = useState(today);
  const entry = useEntry(date);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">
        {formatDate(date)}
        <span className="ml-2 text-base font-normal text-muted-foreground">今日の日記</span>
      </h1>
      {entry.isPending ? (
        <Loading />
      ) : entry.isError ? (
        <ErrorMessage error={entry.error} onRetry={() => entry.refetch()} />
      ) : entry.data ? (
        <EntryView
          detail={entry.data}
          onDateChanged={(newDate) => navigate({ to: "/entries/$date", params: { date: newDate } })}
        />
      ) : (
        <>
          <NotesPanel date={date} />
          <Interview date={date} />
        </>
      )}
    </div>
  );
}
