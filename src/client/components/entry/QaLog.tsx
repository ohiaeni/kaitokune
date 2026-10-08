import type { QA } from "../../../shared/schemas";

/** 日記のもとになった AI との会話（折りたたみ）。会話がなければ何も出さない */
export function QaLog({ qa }: { qa: QA[] }) {
  if (qa.length === 0) {
    return null;
  }
  return (
    <details className="rounded-xl border px-4 py-3 text-sm">
      <summary className="cursor-pointer text-muted-foreground">AI との会話を見る</summary>
      <dl className="mt-3 flex flex-col gap-3">
        {qa.map((x, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 並び順が固定の読み取り専用リスト
          <div key={i}>
            <dt className="font-medium">Q. {x.question}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-muted-foreground">A. {x.answer}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
