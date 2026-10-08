import { ApiError } from "../../lib/api";
import { Button } from "./Button";

export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isLimit = error instanceof ApiError && error.code === "daily_limit";
  const message = error instanceof Error ? error.message : "エラーが発生しました";
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
    >
      <p>{message}</p>
      {isLimit && <p className="text-xs opacity-80">無料枠を守るための上限です。明日になるとリセットされます。</p>}
      {onRetry && !isLimit && (
        <Button variant="secondary" className="self-start" onClick={onRetry}>
          もう一度試す
        </Button>
      )}
    </div>
  );
}
