import { ApiError } from "../../lib/api";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";

/** API などのエラー。AI の 1 日の上限に達したときは理由を添え、それ以外は onRetry があれば再試行ボタンを出す */
export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isLimit = error instanceof ApiError && error.code === "daily_limit";
  const message = error instanceof Error ? error.message : "エラーが発生しました";
  return (
    <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
      <AlertDescription className="text-destructive">
        <p>{message}</p>
        {isLimit && <p className="text-xs opacity-80">無料枠を守るための上限です。明日になるとリセットされます。</p>}
        {onRetry && !isLimit && (
          <Button variant="outline" className="mt-1 text-foreground" onClick={onRetry}>
            もう一度試す
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
