import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { EntryDetail } from "../../shared/schemas";
import { api, queryKeys } from "../lib/api";
import { MOODS } from "../lib/mood";
import { DiaryEditor } from "./DiaryEditor";
import { Button, Card, ErrorMessage } from "./ui";

export function EntryView({ detail, onDeleted }: { detail: EntryDetail; onDeleted?: () => void }) {
  const { entry, qa } = detail;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const mood = MOODS.find((m) => m.value === entry.mood);

  const save = useMutation({
    mutationFn: ({ body, mood }: { body: string; mood: number | null }) => api.saveEntry(entry.date, { body, mood }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.entries });
      setEditing(false);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteEntry(entry.date),
    onSuccess: async () => {
      // 一覧に戻る前に詳細のキャッシュを消し、削除済みの日記が一瞬表示されるのを防ぐ
      queryClient.removeQueries({ queryKey: queryKeys.entry(entry.date) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.entries });
      onDeleted?.();
    },
  });

  if (editing) {
    return (
      <section className="flex flex-col gap-4">
        <DiaryEditor
          initialBody={entry.body}
          initialMood={entry.mood}
          saving={save.isPending}
          onSave={(body, mood) => save.mutate({ body, mood })}
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

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setEditing(true)}>
          編集する
        </Button>
        <Button
          variant="danger"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm("この日記を削除しますか？元に戻せません。")) remove.mutate();
          }}
        >
          {remove.isPending ? "削除中…" : "削除"}
        </Button>
      </div>
      {remove.error && <ErrorMessage error={remove.error} />}
    </section>
  );
}
