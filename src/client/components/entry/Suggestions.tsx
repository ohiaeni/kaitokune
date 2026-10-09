import { Card } from "../ui/card";

/** 日記と一緒に AI が提案した、明日やってみること。提案がなければ何も出さない */
export function Suggestions({ suggestions }: { suggestions: string[] }) {
  if (suggestions.length === 0) {
    return null;
  }
  return (
    <Card className="block border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
      <h2 className="mb-2 font-medium text-sm">明日やってみること</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
        {suggestions.map((x, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 並び順が固定の読み取り専用リスト
          <li key={i}>{x}</li>
        ))}
      </ul>
    </Card>
  );
}
