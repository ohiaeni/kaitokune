import { Button } from "../ui";

/** 質問が終わったあとの「日記にまとめる」の案内 */
export function ComposePrompt({
  disabled,
  composing,
  onCompose,
}: {
  disabled: boolean;
  composing: boolean;
  onCompose: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/30">
      <p className="text-sm">お疲れさまでした。回答をもとに今日の日記をまとめます。</p>
      <Button disabled={disabled} onClick={onCompose}>
        {composing ? "まとめています…" : "日記にまとめる"}
      </Button>
    </div>
  );
}
