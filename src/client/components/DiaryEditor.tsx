import { type ReactNode, useState } from "react";
import { MOODS } from "../../shared/constants";
import { Button, TextArea } from "./ui";

function MoodPicker({ value, onChange }: { value: number | null; onChange: (mood: number | null) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm text-stone-600 dark:text-stone-400">今日の気分</legend>
      <div className="flex gap-2">
        {MOODS.map((m) => {
          const selected = value === m.value;
          return (
            <button
              key={m.value}
              type="button"
              aria-pressed={selected}
              title={m.label}
              onClick={() => onChange(selected ? null : m.value)}
              className={`flex size-11 items-center justify-center rounded-full text-2xl transition ${
                selected
                  ? "bg-amber-100 ring-2 ring-amber-500 dark:bg-amber-900/40"
                  : "bg-stone-100 opacity-60 hover:opacity-100 dark:bg-stone-800"
              }`}
            >
              <span aria-hidden>{m.emoji}</span>
              <span className="sr-only">{m.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function DiaryEditor({
  initialBody,
  initialMood,
  saving,
  onSave,
  children,
}: {
  initialBody: string;
  initialMood: number | null;
  saving: boolean;
  onSave: (body: string, mood: number | null) => void;
  /** 保存ボタンの横に並べる追加の操作 */
  children?: ReactNode;
}) {
  const [body, setBody] = useState(initialBody);
  const [mood, setMood] = useState(initialMood);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) onSave(body.trim(), mood);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm text-stone-600 dark:text-stone-400">日記（自由に直せます）</span>
        <TextArea value={body} onChange={(e) => setBody(e.target.value)} rows={12} maxLength={10000} />
        <span className="self-end text-stone-500 text-xs">{body.length} 文字</span>
      </label>
      <MoodPicker value={mood} onChange={setMood} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={saving || !body.trim()}>
          {saving ? "保存中…" : "保存する"}
        </Button>
        {children}
      </div>
    </form>
  );
}
