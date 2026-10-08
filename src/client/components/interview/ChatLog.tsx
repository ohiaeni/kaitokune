import type { ReactNode } from "react";
import type { Draft } from "../../lib/draft";

/** これまでの問答と回答待ちの質問を吹き出しで並べる。thinking なら AI の考え中の表示を出す */
export function ChatLog({ draft, thinking }: { draft: Draft; thinking: boolean }) {
  return (
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
      {thinking && (
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
  );
}

function Bubble({ from, children }: { from: "ai" | "me"; children: ReactNode }) {
  return from === "ai" ? (
    <div className="max-w-[85%] self-start whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-card px-4 py-2.5 leading-relaxed text-card-foreground shadow-sm dark:bg-secondary">
      {children}
    </div>
  ) : (
    <div className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-amber-100 px-4 py-2.5 leading-relaxed dark:bg-amber-900/50">
      {children}
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: delay }} />
  );
}
