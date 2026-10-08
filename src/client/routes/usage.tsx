import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDate } from "../../shared/date";
import type { CloudflareUsage, UsageMeter } from "../../shared/schemas";
import { Button, Card, ErrorMessage, Spinner } from "../components/ui";
import { api, queryKeys } from "../lib/api";

export const Route = createFileRoute("/usage")({ component: UsagePage });

/** これ以上使ったら、残りが少ないことを色で知らせる */
const WARN_RATIO = 0.8;

const formatCount = (n: number) => n.toLocaleString("ja-JP");

function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  return `${Math.ceil(n / 1e3)} KB`;
}

function Meter({
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

/** 00:00 UTC が端末の時刻で何時か（日本なら "9:00"） */
function utcMidnightLocal(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toLocaleTimeString("ja-JP", { hour: "numeric", minute: "2-digit" });
}

function CloudflareSection({ usage }: { usage: CloudflareUsage }) {
  if (usage.status === "unconfigured") {
    return (
      <p className="text-sm text-stone-600 dark:text-stone-400">
        Analytics の API トークンが未設定のため表示できません。設定方法は docs/setup.md
        の「アプリで確認する」を参照してください。
      </p>
    );
  }
  if (usage.status === "error") return <ErrorMessage error={new Error(usage.message)} />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-stone-500 dark:text-stone-400">
        {usage.date}（UTC）の値です。容量以外は毎日 {utcMidnightLocal()} にリセットされます。反映まで数分かかります。
      </p>
      <Meter label="Workers のリクエスト" meter={usage.workersRequests} />
      <Meter label="Workers AI（Neurons）" meter={usage.workersAiNeurons} />
      <Meter label="D1 の読み取り行数" meter={usage.d1RowsRead} />
      <Meter label="D1 の書き込み行数" meter={usage.d1RowsWritten} />
      <Meter label="D1 の容量（合計）" meter={usage.d1StorageBytes} format={formatBytes} />
    </div>
  );
}

function UsagePage() {
  const usage = useQuery({ queryKey: queryKeys.usage, queryFn: api.getUsage, staleTime: 60_000 });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">使用量</h1>
        <Button variant="ghost" disabled={usage.isFetching} onClick={() => usage.refetch()}>
          {usage.isFetching ? "更新中…" : "更新"}
        </Button>
      </div>
      {usage.isPending ? (
        <Spinner />
      ) : usage.isError ? (
        <ErrorMessage error={usage.error} onRetry={() => usage.refetch()} />
      ) : (
        <>
          <Card className="flex flex-col gap-4">
            <h2 className="font-bold">AI の利用回数（あなたの 1 日の上限）</h2>
            <Meter label={`今日（${formatDate(usage.data.ai.date)}）`} meter={usage.data.ai.today} />
            {usage.data.ai.history.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm text-stone-600 dark:text-stone-400">
                {usage.data.ai.history.map((h) => (
                  <li key={h.date} className="flex justify-between tabular-nums">
                    <span>{formatDate(h.date)}</span>
                    <span>{h.count} 回</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="flex flex-col gap-4">
            <h2 className="font-bold">Cloudflare の無料枠</h2>
            <CloudflareSection usage={usage.data.cloudflare} />
          </Card>
        </>
      )}
    </div>
  );
}
