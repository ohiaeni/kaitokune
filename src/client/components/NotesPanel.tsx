import { useState } from "react";
import { MAX_NOTES, NOTE_MAX_LENGTH } from "../../shared/constants";
import { useAddNote, useDeleteNote, useNotes } from "../lib/queries";
import { Button, Card, ErrorMessage, QueryResult, TextInput } from "./ui";

/** 日中に思ったことをメモしておく欄。メモは「日記にまとめる」ときに AI に渡す */
export function NotesPanel({ date }: { date: string }) {
  const notes = useNotes(date);
  const [text, setText] = useState("");
  const add = useAddNote(date);
  const remove = useDeleteNote(date);

  const isFull = (notes.data?.length ?? 0) >= MAX_NOTES;
  const submit = () => {
    const body = text.trim();
    if (body && !add.isPending && !isFull) add.mutate(body, { onSuccess: () => setText("") });
  };

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium">今日のメモ</h2>
        <p className="text-xs text-stone-500">思いついたことを書いておくと、AI が質問や日記に使います</p>
      </div>

      <QueryResult query={notes}>
        {(data) =>
          data.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {data.map((n) => (
                <li key={n.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                  <span className="flex-1 whitespace-pre-wrap py-0.5">{n.body}</span>
                  <button
                    type="button"
                    aria-label={`メモ「${n.body}」を削除`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(n.id)}
                    className="rounded-full px-2 text-stone-400 hover:bg-stone-200/60 hover:text-stone-700 disabled:opacity-50 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </QueryResult>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextInput
          variant="pill"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={NOTE_MAX_LENGTH}
          disabled={isFull}
          placeholder={isFull ? `メモは ${MAX_NOTES} 件までです` : "例: 昼に新しいカフェに行った"}
          aria-label="メモ"
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="secondary" disabled={!text.trim() || add.isPending || isFull}>
          {add.isPending ? "追加中…" : "追加"}
        </Button>
      </form>
      {(add.error || remove.error) && <ErrorMessage error={add.error ?? remove.error} />}
    </Card>
  );
}
