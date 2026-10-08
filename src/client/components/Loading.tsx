import { Spinner } from "./ui/spinner";

/** 読み込み中の表示 */
export function Loading({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
      <Spinner aria-hidden role="presentation" />
      {label}
    </div>
  );
}
