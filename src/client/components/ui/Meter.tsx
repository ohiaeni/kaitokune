import type { UsageMeter } from "../../../shared/schemas";

/** これ以上使ったら、残りが少ないことを色で知らせる */
const WARN_RATIO = 0.8;

const formatCount = (n: number) => n.toLocaleString("ja-JP");

/** 上限に対する使用量のメーター */
export function Meter({
  label,
  meter,
  format = formatCount,
}: {
  label: string;
  meter: UsageMeter;
  format?: (n: number) => string;
}) {
  const ratio = meter.limit > 0 ? meter.used / meter.limit : 0;
  const percent = Math.min(100, ratio * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="text-stone-600 tabular-nums dark:text-stone-400">
          {format(meter.used)} / {format(meter.limit)}
          <span className="ml-1 text-xs">（{percent < 1 && meter.used > 0 ? "<1" : Math.round(percent)}%）</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={meter.limit}
        aria-valuenow={meter.used}
        className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
      >
        <div
          className={`h-full rounded-full ${ratio >= WARN_RATIO ? "bg-red-500" : "bg-amber-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
