import { useState } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

/** 質問への回答欄。canFinish なら「質問はここまでにする」も出す */
export function AnswerForm({
  disabled,
  canFinish,
  onSubmit,
  onFinish,
}: {
  disabled: boolean;
  canFinish: boolean;
  /** 回答を送る。受け付けたら true を返す（入力欄を空にする） */
  onSubmit: (answer: string) => boolean;
  onFinish: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const submit = () => {
    if (onSubmit(answer)) {
      setAnswer("");
    }
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => {
          // 日本語入力の変換確定（Enter）と区別するため、送信は ⌘/Ctrl + Enter にする
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        rows={3}
        maxLength={1000}
        placeholder="気軽に答えてください"
        aria-label="回答"
        className="field-sizing-fixed resize-y leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={!answer.trim() || disabled}>
          答える
        </Button>
        {canFinish && (
          <Button variant="outline" disabled={disabled} onClick={onFinish}>
            質問はここまでにする
          </Button>
        )}
        <span className="ml-auto hidden text-muted-foreground text-xs sm:inline">⌘ / Ctrl + Enter で送信</span>
      </div>
    </form>
  );
}
