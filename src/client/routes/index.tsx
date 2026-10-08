import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { formatDate } from "../../shared/date";
import { EntryView } from "../components/EntryView";
import { Interview } from "../components/Interview";
import { NotesPanel } from "../components/NotesPanel";
import { QueryResult } from "../components/QueryResult";
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
      <h1 className="font-bold text-2xl">
        {formatDate(date)}
        <span className="ml-2 font-normal text-base text-muted-foreground">今日の日記</span>
      </h1>
      <QueryResult query={entry}>
        {(detail) =>
          detail ? (
            <EntryView
              detail={detail}
              onDateChanged={(newDate) => navigate({ to: "/entries/$date", params: { date: newDate } })}
            />
          ) : (
            <>
              <NotesPanel date={date} />
              <Interview date={date} />
            </>
          )
        }
      </QueryResult>
    </div>
  );
}
