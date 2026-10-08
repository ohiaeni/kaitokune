import { createFileRoute } from "@tanstack/react-router";
import { formatDate } from "../../shared/date";
import type { CloudflareUsage } from "../../shared/schemas";
import { ErrorMessage } from "../components/ErrorMessage";
import { QueryResult } from "../components/QueryResult";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Meter } from "../components/usage/Meter";
import { useUsage } from "../lib/queries";

export const Route = createFileRoute("/usage")({ component: UsagePage });

function formatBytes(n: number): string {
  if (n >= 1e9) {
    return `${(n / 1e9).toFixed(2)} GB`;
  }
  if (n >= 1e6) {
    return `${(n / 1e6).toFixed(1)} MB`;
  }
  return `${Math.ceil(n / 1e3)} KB`;
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
      <p className="text-muted-foreground text-sm">
        Analytics の API トークンが未設定のため表示できません。設定方法は docs/setup.md
        の「アプリで確認する」を参照してください。
      </p>
    );
  }
  if (usage.status === "error") {
    return <ErrorMessage error={new Error(usage.message)} />;
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">
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
  const usage = useUsage();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">使用量</h1>
        <Button variant="ghost" disabled={usage.isFetching} onClick={() => usage.refetch()}>
          {usage.isFetching ? "更新中…" : "更新"}
        </Button>
      </div>
      <QueryResult query={usage}>
        {(data) => (
          <>
            <Card className="gap-4 p-4">
              <h2 className="font-bold">AI の利用回数（あなたの 1 日の上限）</h2>
              <Meter label={`今日（${formatDate(data.ai.date)}）`} meter={data.ai.today} />
              {data.ai.history.length > 0 && (
                <ul className="flex flex-col gap-1 text-muted-foreground text-sm">
                  {data.ai.history.map((h) => (
                    <li key={h.date} className="flex justify-between tabular-nums">
                      <span>{formatDate(h.date)}</span>
                      <span>{h.count} 回</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="gap-4 p-4">
              <h2 className="font-bold">Cloudflare の無料枠</h2>
              <CloudflareSection usage={data.cloudflare} />
            </Card>
          </>
        )}
      </QueryResult>
    </div>
  );
}
