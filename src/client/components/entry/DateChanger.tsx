import { useState } from "react";
import { formatDate } from "../../../shared/date";
import { today } from "../../lib/date";
import { loadDraft, removeDraft } from "../../lib/draft";
import { useChangeEntryDate } from "../../lib/queries";
import { Button, ErrorMessage, TextInput } from "../ui";

/** 日記の日付を変えるフォーム。変更先に書きかけの会話があれば、消してよいか確かめる */
export function DateChanger({
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
        if (!newDate || newDate === date || newDate > max) {
          return;
        }
        const hasDraft = loadDraft(newDate) !== null;
        if (hasDraft && !confirm(`${formatDate(newDate)}の書きかけの会話は削除されます。日付を変更しますか？`)) {
          return;
        }
        change.mutate({ date, newDate });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm text-stone-600 dark:text-stone-400">新しい日付</span>
        <TextInput
          type="date"
          value={newDate}
          max={max}
          required
          onChange={(e) => setNewDate(e.target.value)}
          className="self-start"
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
