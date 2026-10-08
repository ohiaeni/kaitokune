import type { QA } from "../../../shared/schemas";

/** 日記のもとになった AI との会話（折りたたみ）。会話がなければ何も出さない */
export function QaLog({ qa }: { qa: QA[] }) {
  if (qa.length === 0) return null;
  return (
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
  );
}
