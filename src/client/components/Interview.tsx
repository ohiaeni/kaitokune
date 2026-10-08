import { useEffect, useRef } from "react";
import { MIN_QUESTIONS } from "../../shared/constants";
import { useInterview } from "../hooks/useInterview";
import { AnswerForm } from "./interview/AnswerForm";
import { ChatLog } from "./interview/ChatLog";
import { ComposedEditor } from "./interview/ComposedEditor";
import { ComposePrompt } from "./interview/ComposePrompt";
import { Button, ErrorMessage } from "./ui";

export function Interview({ date }: { date: string }) {
  const { draft, busy, error, submitAnswer, finishQuestions, compose, save, restart, backToChat } = useInterview(date);
  const bottomRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 会話が進むたびに最下部へスクロールするためのトリガー
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [draft.qa.length, draft.pending, draft.done, busy]);

  const errorMessage = error && <ErrorMessage error={error.error} onRetry={error.retry} />;

  if (draft.composed !== null) {
    return (
      <section className="flex flex-col gap-4">
        <ComposedEditor body={draft.composed} busy={busy} onSave={save} onRecompose={compose} onBack={backToChat} />
        {errorMessage}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <ChatLog draft={draft} thinking={busy === "next"} />
      {errorMessage}
      {draft.pending && (
        <AnswerForm
          disabled={busy !== null}
          canFinish={draft.qa.length >= MIN_QUESTIONS}
          onSubmit={submitAnswer}
          onFinish={finishQuestions}
        />
      )}
      {draft.done && <ComposePrompt disabled={busy !== null} composing={busy === "compose"} onCompose={compose} />}
      {draft.qa.length > 0 && (
        <Button
          variant="ghost"
          className="self-start text-xs"
          disabled={busy !== null}
          onClick={() => {
            if (confirm("会話を最初からやり直しますか？")) restart();
          }}
        >
          最初からやり直す
        </Button>
      )}
      <div ref={bottomRef} />
    </section>
  );
}
