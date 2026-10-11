import { type ReactNode, useId, useState } from "react";
import { MOODS } from "../../../shared/constants";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";

/** 気分を 1 つ選ぶ。選んでいるものをもう一度押すと未選択に戻る */
function MoodPicker({ value, onChange }: { value: number | null; onChange: (mood: number | null) => void }) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-muted-foreground text-sm">
        今日の気分
      </span>
      <ToggleGroup
        type="single"
        spacing={2}
        aria-labelledby={labelId}
        value={value === null ? "" : String(value)}
        onValueChange={(next) => onChange(next ? Number(next) : null)}
      >
        {MOODS.map((m) => (
          <ToggleGroupItem
            key={m.value}
            value={String(m.value)}
            title={m.label}
            aria-label={m.label}
            className="size-11 rounded-full bg-muted px-0 text-2xl opacity-60 hover:bg-muted hover:opacity-100 data-[state=on]:bg-amber-100 data-[state=on]:opacity-100 data-[state=on]:ring-2 data-[state=on]:ring-primary dark:data-[state=on]:bg-amber-900/40"
          >
            <span aria-hidden>{m.emoji}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
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
        if (body.trim()) {
          onSave(body.trim(), mood);
        }
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">日記（自由に直せます）</span>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          maxLength={10000}
          className="field-sizing-fixed resize-y leading-relaxed"
        />
        <span className="self-end text-muted-foreground text-xs">{body.length} 文字</span>
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
