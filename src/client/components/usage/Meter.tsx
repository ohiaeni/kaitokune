import type { UsageMeter } from "../../../shared/schemas";
import { Progress } from "../ui/progress";

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
        <span className="text-muted-foreground tabular-nums">
          {format(meter.used)} / {format(meter.limit)}
          <span className="ml-1 text-xs">（{percent < 1 && meter.used > 0 ? "<1" : Math.round(percent)}%）</span>
        </span>
      </div>
      <Progress
        value={percent}
        aria-label={label}
        className={`bg-secondary ${ratio >= WARN_RATIO ? "*:data-[slot=progress-indicator]:bg-red-500" : "*:data-[slot=progress-indicator]:bg-amber-500"}`}
      />
    </div>
  );
}
