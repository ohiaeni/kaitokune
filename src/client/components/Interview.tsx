import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { MIN_QUESTIONS } from "../../shared/constants";
import type { QA } from "../../shared/schemas";
import { api, queryKeys } from "../lib/api";
import { loadJson, removeItem, saveJson } from "../lib/storage";
import { DiaryEditor } from "./DiaryEditor";
import { Button, ErrorMessage } from "./ui";

/** 会話の途中経過。リロードしても続きから再開できるよう localStorage に保存する */
type Draft = {
  qa: QA[];
  /** 回答待ちの質問 */
  pending: string | null;
  /** 質問が終わり、日記にまとめる段階 */
  done: boolean;
  /** AI がまとめた日記本文 */
  composed: string | null;
};

const EMPTY_DRAFT: Draft = { qa: [], pending: null, done: false, composed: null };
export const draftKey = (date: string) => `kaitokune:draft:${date}`;

type Busy = "next" | "compose" | "save" | null;

export function Interview({ date }: { date: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => loadJson<Draft>(draftKey(date)) ?? EMPTY_DRAFT);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ error: unknown; retry: () => void } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => saveJson(draftKey(date), draft), [date, draft]);

  const run = useCallback(async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError({ error: e, retry: () => run(kind, fn) });
    } finally {
      setBusy(null);
    }
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

  const compose = useCallback(
    (qa: QA[]) =>
      run("compose", async () => {
        const { body } = await api.compose(date, qa);
        setDraft((d) => ({ ...d, composed: body }));
      }),
    [date, run],
  );

  // 最初の質問を自動で取りに行く（StrictMode の二重実行を避ける）
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!draft.pending && !draft.done && draft.composed === null) askNext(draft.qa);
  }, [askNext, draft]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 会話が進むたびに最下部へスクロールするためのトリガー
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [draft.qa.length, draft.pending, draft.done, busy]);

  const submitAnswer = () => {
    const text = answer.trim();
    if (!draft.pending || !text || busy) return;
    const qa = [...draft.qa, { question: draft.pending, answer: text }];
    setDraft((d) => ({ ...d, qa, pending: null }));
    setAnswer("");
    askNext(qa);
  };

  const save = (body: string, mood: number | null) =>
    run("save", async () => {
      await api.saveEntry(date, { body, mood, qa: draft.qa });
      removeItem(draftKey(date));
      await queryClient.invalidateQueries({ queryKey: queryKeys.entries });
    });

  const restart = () => {
    if (!confirm("会話を最初からやり直しますか？")) return;
    setDraft(EMPTY_DRAFT);
    setAnswer("");
    askNext([]);
  };

  if (draft.composed !== null) {
    return (
      <section className="flex flex-col gap-4">
        <DiaryEditor
          key={draft.composed}
          initialBody={draft.composed}
          initialMood={null}
          saving={busy === "save"}
          onSave={save}
        >
          <Button variant="secondary" disabled={busy !== null} onClick={() => compose(draft.qa)}>
            {busy === "compose" ? "書き直し中…" : "AI に書き直してもらう"}
          </Button>
          <Button variant="ghost" disabled={busy !== null} onClick={() => setDraft((d) => ({ ...d, composed: null }))}>
            会話に戻る
          </Button>
        </DiaryEditor>
        {error && <ErrorMessage error={error.error} onRetry={error.retry} />}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {draft.qa.map((x, i) => (
          // 会話ログは追記のみで並び替えないため index を key にしてよい
          // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
          <li key={i} className="flex flex-col gap-3">
            <Bubble from="ai">{x.question}</Bubble>
            <Bubble from="me">{x.answer}</Bubble>
          </li>
        ))}
        {draft.pending && (
          <li>
            <Bubble from="ai">{draft.pending}</Bubble>
          </li>
        )}
        {busy === "next" && (
          <li>
            <Bubble from="ai">
              <span className="inline-flex gap-1" aria-hidden>
                <Dot delay="0ms" />
                <Dot delay="150ms" />
                <Dot delay="300ms" />
              </span>
              <span className="sr-only">考え中</span>
            </Bubble>
          </li>
        )}
      </ol>

      {error && <ErrorMessage error={error.error} onRetry={error.retry} />}

      {draft.pending && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitAnswer();
          }}
        >
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              // 日本語入力の変換確定（Enter）と区別するため、送信は ⌘/Ctrl + Enter にする
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submitAnswer();
              }
            }}
            rows={3}
            maxLength={1000}
            placeholder="気軽に答えてください"
            aria-label="回答"
            className="w-full resize-y rounded-xl border border-stone-300 bg-white p-3 leading-relaxed outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 dark:border-stone-700 dark:bg-stone-900"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!answer.trim() || busy !== null}>
              答える
            </Button>
            {draft.qa.length >= MIN_QUESTIONS && (
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() => setDraft((d) => ({ ...d, pending: null, done: true }))}
              >
                質問はここまでにする
              </Button>
            )}
            <span className="ml-auto hidden text-xs text-stone-500 sm:inline">⌘ / Ctrl + Enter で送信</span>
          </div>
        </form>
      )}

      {draft.done && (
        <div className="flex flex-col items-start gap-2 rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/30">
          <p className="text-sm">お疲れさまでした。回答をもとに今日の日記をまとめます。</p>
          <Button disabled={busy !== null} onClick={() => compose(draft.qa)}>
            {busy === "compose" ? "まとめています…" : "日記にまとめる"}
          </Button>
        </div>
      )}

      {draft.qa.length > 0 && (
        <Button variant="ghost" className="self-start text-xs" disabled={busy !== null} onClick={restart}>
          最初からやり直す
        </Button>
      )}
      <div ref={bottomRef} />
    </section>
  );
}

function Bubble({ from, children }: { from: "ai" | "me"; children: ReactNode }) {
  return from === "ai" ? (
    <div className="max-w-[85%] self-start whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 leading-relaxed shadow-sm dark:bg-stone-800">
      {children}
    </div>
  ) : (
    <div className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-amber-100 px-4 py-2.5 leading-relaxed dark:bg-amber-900/50">
      {children}
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return <span className="size-1.5 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: delay }} />;
}
