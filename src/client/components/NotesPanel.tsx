import { XIcon } from "lucide-react";
import { useState } from "react";
import { MAX_NOTES, NOTE_MAX_LENGTH } from "../../shared/constants";
import { useAddNote, useDeleteNote, useNotes } from "../hooks/queries";
import { ErrorMessage } from "./ErrorMessage";
import { QueryResult } from "./QueryResult";
import { Button } from "./ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

/** 日中に思ったことをメモしておく欄。メモは「日記にまとめる」ときに AI に渡す */
export function NotesPanel({ date }: { date: string }) {
  const notes = useNotes(date);
  const [text, setText] = useState("");
  const add = useAddNote(date);
  const remove = useDeleteNote(date);

  const isFull = (notes.data?.length ?? 0) >= MAX_NOTES;
  const submit = () => {
    const body = text.trim();
    if (body && !add.isPending && !isFull) {
      add.mutate(body, { onSuccess: () => setText("") });
    }
  };

  return (
    <Card className="gap-3 p-4">
      <CardHeader className="gap-1 px-0">
        <CardTitle className="font-medium">
          <h2>今日のメモ</h2>
        </CardTitle>
        <CardDescription className="text-xs">思いついたことを書いておくと、AI が質問や日記に使います</CardDescription>
      </CardHeader>

      <QueryResult query={notes}>
        {(data) =>
          data.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {data.map((n) => (
                <li key={n.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span className="flex-1 whitespace-pre-wrap py-0.5">{n.body}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`メモ「${n.body}」を削除`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(n.id)}
                    className="-my-1 text-muted-foreground"
                  >
                    <XIcon />
                  </Button>
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
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={NOTE_MAX_LENGTH}
          disabled={isFull}
          placeholder={isFull ? `メモは ${MAX_NOTES} 件までです` : "例: 昼に新しいカフェに行った"}
          aria-label="メモ"
          className="h-10 min-w-0 flex-1 rounded-full px-4"
        />
        <Button type="submit" variant="outline" disabled={!text.trim() || add.isPending || isFull}>
          {add.isPending ? "追加中…" : "追加"}
        </Button>
      </form>
      {(add.error || remove.error) && <ErrorMessage error={add.error ?? remove.error} />}
    </Card>
  );
}
