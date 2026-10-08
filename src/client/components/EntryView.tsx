import { useState } from "react";
import type { EntryDetail } from "../../shared/schemas";
import { useDeleteEntry, useSaveEntry } from "../lib/queries";
import { DiaryEditor } from "./DiaryEditor";
import { DateChanger } from "./entry/DateChanger";
import { EntryBody } from "./entry/EntryBody";
import { QaLog } from "./entry/QaLog";
import { Button, Card, ErrorMessage } from "./ui";

/** 保存済みの日記。表示 / 編集 / 日付変更を切り替え、削除もできる */
export function EntryView({
  detail,
  onDeleted,
  onDateChanged,
}: {
  detail: EntryDetail;
  onDeleted?: () => void;
  onDateChanged: (newDate: string) => void;
}) {
  const { entry, qa } = detail;
  const [editing, setEditing] = useState(false);
  const [changingDate, setChangingDate] = useState(false);

  const save = useSaveEntry({ onSuccess: () => setEditing(false) });
  const remove = useDeleteEntry({ onSuccess: () => onDeleted?.() });

  if (editing) {
    return (
      <section className="flex flex-col gap-4">
        <DiaryEditor
          initialBody={entry.body}
          initialMood={entry.mood}
          saving={save.isPending}
          onSave={(body, mood) => save.mutate({ date: entry.date, payload: { body, mood } })}
        >
          <Button variant="ghost" disabled={save.isPending} onClick={() => setEditing(false)}>
            キャンセル
          </Button>
        </DiaryEditor>
        {save.error && <ErrorMessage error={save.error} />}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <EntryBody entry={entry} />
      <QaLog qa={qa} />

      {changingDate && (
        <Card>
          <DateChanger date={entry.date} onChanged={onDateChanged} onCancel={() => setChangingDate(false)} />
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setEditing(true)}>
          編集する
        </Button>
        {!changingDate && (
          <Button variant="ghost" onClick={() => setChangingDate(true)}>
            日付を変更
          </Button>
        )}
        <Button
          variant="danger"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm("この日記を削除しますか？元に戻せません。")) {
              remove.mutate(entry.date);
            }
          }}
        >
          {remove.isPending ? "削除中…" : "削除"}
        </Button>
      </div>
      {remove.error && <ErrorMessage error={remove.error} />}
    </section>
  );
}
