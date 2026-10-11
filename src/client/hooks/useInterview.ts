import { useCallback, useEffect, useRef, useState } from "react";
import type { QA } from "../../shared/schemas";
import { api } from "../lib/api";
import { type Draft, EMPTY_DRAFT, loadDraft, removeDraft, saveDraft } from "../lib/draft";
import { useSaveEntry } from "./queries";

/** 実行中の処理（質問の取得・日記の生成・保存） */
export type Busy = "next" | "compose" | "save" | null;

/** AI との会話の状態と操作。会話の途中経過は localStorage に保存し、リロードしても続きから再開できる */
export function useInterview(date: string) {
  const saveEntry = useSaveEntry();
  const [draft, setDraft] = useState<Draft>(() => loadDraft(date) ?? EMPTY_DRAFT);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ error: unknown; retry: () => void } | null>(null);
  const started = useRef(false);

  useEffect(() => saveDraft(date, draft), [date, draft]);

  /** 処理を実行する。失敗したらエラーと再試行の操作を error に入れるので、呼び出し側で待つ必要はない */
  const run = useCallback((kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    fn()
      .catch((e: unknown) => setError({ error: e, retry: () => run(kind, fn) }))
      .finally(() => setBusy(null));
  }, []);

  const askNext = useCallback(
    (qa: QA[]) =>
      run("next", async () => {
        const res = await api.nextQuestion(date, qa);
        setDraft((d) =>
          "question" in res ? { ...d, qa, pending: res.question } : { ...d, qa, pending: null, done: true },
        );
      }),
    [date, run],
  );

  // 最初の質問を自動で取りに行く（StrictMode の二重実行を避ける）
  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    if (!draft.pending && !draft.done && draft.composed === null) {
      askNext(draft.qa);
    }
  }, [askNext, draft]);

  /** 回答待ちの質問に答える。受け付けたら true（入力欄を空にしてよい） */
  const submitAnswer = (answer: string): boolean => {
    const text = answer.trim();
    if (!draft.pending || !text || busy) {
      return false;
    }
    const qa = [...draft.qa, { question: draft.pending, answer: text }];
    setDraft((d) => ({ ...d, qa, pending: null }));
    askNext(qa);
    return true;
  };

  /** 残りの質問をやめて、日記にまとめる段階に進む */
  const finishQuestions = () => setDraft((d) => ({ ...d, pending: null, done: true }));

  /** 回答から日記を生成する（生成後に呼べば書き直し） */
  const compose = () =>
    run("compose", async () => {
      const { body, suggestions } = await api.compose(date, draft.qa);
      setDraft((d) => ({ ...d, composed: body, suggestions }));
    });

  const save = (body: string, mood: number | null) =>
    run("save", async () => {
      await saveEntry.mutateAsync({ date, payload: { body, mood, qa: draft.qa, suggestions: draft.suggestions } });
      removeDraft(date);
    });

  /** 会話を最初からやり直す */
  const restart = () => {
    setDraft(EMPTY_DRAFT);
    askNext([]);
  };

  /** 生成した日記を捨てて、会話の画面に戻る */
  const backToChat = () => setDraft((d) => ({ ...d, composed: null, suggestions: [] }));

  return { draft, busy, error, submitAnswer, finishQuestions, compose, save, restart, backToChat };
}
