import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ApiError } from "../lib/api";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400",
  secondary:
    "border border-stone-300 bg-white text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800",
  ghost: "text-stone-600 hover:bg-stone-200/60 dark:text-stone-300 dark:hover:bg-stone-800",
  danger: "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Spinner({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-500 dark:text-stone-400">
      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isLimit = error instanceof ApiError && error.code === "daily_limit";
  const message = error instanceof Error ? error.message : "エラーが発生しました";
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
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

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900 ${className}`}
    >
      {children}
    </div>
  );
}
