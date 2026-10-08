import { useState } from "react";
import { findMood } from "../../shared/constants";
import { formatDate } from "../../shared/date";
import type { EntryDetail } from "../../shared/schemas";
import { today } from "../lib/date";
import { loadDraft, removeDraft } from "../lib/draft";
import { useChangeEntryDate, useDeleteEntry, useSaveEntry } from "../lib/queries";
import { DiaryEditor } from "./DiaryEditor";
import { Button, Card, ErrorMessage } from "./ui";

function DateChanger({
  date,
  onChanged,
  onCancel,
}: {
  date: string;
  onChanged: (newDate: string) => void;
  onCancel: () => void;
}) {
  const [newDate, setNewDate] = useState(date);
  const max = today();

  const change = useChangeEntryDate({
    onSuccess: (_, variables) => {
      // 変更先の日付の書きかけの会話は、日記ができたことで使われなくなるので消す
      removeDraft(variables.newDate);
      onChanged(variables.newDate);
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!newDate || newDate === date || newDate > max) return;
        const hasDraft = loadDraft(newDate) !== null;
        if (hasDraft && !confirm(`${formatDate(newDate)}の書きかけの会話は削除されます。日付を変更しますか？`)) return;
        change.mutate({ date, newDate });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm text-stone-600 dark:text-stone-400">新しい日付</span>
        <input
          type="date"
          value={newDate}
          max={max}
          required
          onChange={(e) => setNewDate(e.target.value)}
          className="self-start rounded-xl border border-stone-300 bg-white px-3 py-2 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 dark:border-stone-700 dark:bg-stone-900"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={change.isPending || !newDate || newDate === date || newDate > max}>
          {change.isPending ? "変更中…" : "日付を変更する"}
        </Button>
        <Button variant="ghost" disabled={change.isPending} onClick={onCancel}>
          キャンセル
        </Button>
      </div>
      {change.error && <ErrorMessage error={change.error} />}
    </form>
  );
}

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
  const mood = findMood(entry.mood);

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
      <Card>
        {mood && (
          <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
            <span className="mr-1 text-xl" aria-hidden>
              {mood.emoji}
            </span>
            {mood.label}
          </p>
        )}
        <p className="whitespace-pre-wrap leading-loose">{entry.body}</p>
      </Card>

      {qa.length > 0 && (
        <details className="rounded-2xl border border-stone-200 px-4 py-3 text-sm dark:border-stone-800">
          <summary className="cursor-pointer text-stone-600 dark:text-stone-400">AI との会話を見る</summary>
          <dl className="mt-3 flex flex-col gap-3">
            {qa.map((x, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 並び順が固定の読み取り専用リスト
              <div key={i}>
                <dt className="font-medium">Q. {x.question}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-stone-700 dark:text-stone-300">A. {x.answer}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

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
            if (confirm("この日記を削除しますか？元に戻せません。")) remove.mutate(entry.date);
          }}
        >
          {remove.isPending ? "削除中…" : "削除"}
        </Button>
      </div>
      {remove.error && <ErrorMessage error={remove.error} />}
    </section>
  );
}
