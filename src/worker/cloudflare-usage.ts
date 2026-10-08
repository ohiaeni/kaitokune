import type { CloudflareUsage } from "../shared/schemas";
import { todayIn } from "./usage";

/**
 * Workers Free プランの無料枠。容量以外は 00:00 UTC にリセットされる。
 * https://developers.cloudflare.com/workers/platform/pricing/
 * https://developers.cloudflare.com/workers-ai/platform/pricing/
 * https://developers.cloudflare.com/d1/platform/pricing/
 */
const FREE_TIER = {
  workersRequests: 100_000,
  workersAiNeurons: 10_000,
  d1RowsRead: 5_000_000,
  d1RowsWritten: 100_000,
  d1StorageBytes: 5_000_000_000,
};

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

// 無料枠はアカウント単位なので、Worker やデータベースでは絞り込まずにアカウント全体を集計する
const QUERY = `query ($accountTag: string!, $date: Date!, $since: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(limit: 1, filter: { date: $date }) { sum { requests } }
      aiInferenceAdaptiveGroups(limit: 1, filter: { date: $date }) { sum { totalNeurons } }
      d1AnalyticsAdaptiveGroups(limit: 1, filter: { date: $date }) { sum { rowsRead rowsWritten } }
      d1StorageAdaptiveGroups(limit: 100, filter: { date_geq: $since }, orderBy: [date_DESC]) {
        dimensions { databaseId date }
        max { databaseSizeBytes }
      }
    }
  }
}`;

type AnalyticsAccount = {
  workersInvocationsAdaptive: { sum: { requests: number } }[];
  aiInferenceAdaptiveGroups: { sum: { totalNeurons: number } }[];
  d1AnalyticsAdaptiveGroups: { sum: { rowsRead: number; rowsWritten: number } }[];
  d1StorageAdaptiveGroups: { dimensions: { databaseId: string; date: string }; max: { databaseSizeBytes: number } }[];
};
type AnalyticsResponse = {
  data?: { viewer: { accounts: AnalyticsAccount[] } } | null;
  errors?: { message: string }[] | null;
};

/** GraphQL Analytics API（無料）から、今日（UTC）の無料枠の消費状況を取得する。失敗しても例外は投げない */
export async function fetchCloudflareUsage({
  token,
  accountId,
  fetcher = fetch,
  now = new Date(),
}: {
  token: string;
  accountId: string;
  fetcher?: typeof fetch;
  now?: Date;
}): Promise<CloudflareUsage> {
  const date = todayIn("UTC", now);
  // 容量は 1 日に数回しか記録されないので、前日の記録も含めて各データベースの最新の値を使う
  const since = todayIn("UTC", new Date(now.getTime() - 24 * 60 * 60 * 1000));

  let res: Response;
  try {
    res = await fetcher(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: QUERY, variables: { accountTag: accountId, date, since } }),
    });
  } catch (e) {
    console.error("Cloudflare analytics request failed", e);
    return { status: "error", message: "Cloudflare の API に接続できませんでした" };
  }
  if (!res.ok) {
    console.error(`Cloudflare analytics HTTP ${res.status}`, (await res.text().catch(() => "")).slice(0, 300));
    return { status: "error", message: `Cloudflare の API がエラーを返しました（HTTP ${res.status}）` };
  }

  const body = (await res.json()) as AnalyticsResponse;
  const account = body.data?.viewer.accounts[0];
  if (body.errors?.length || !account) {
    const detail = body.errors?.map((e) => e.message).join(", ") || "アカウントが見つかりません";
    console.error("Cloudflare analytics error", detail);
    return { status: "error", message: `Cloudflare の API がエラーを返しました: ${detail}` };
  }

  const latestSize = new Map<string, number>();
  for (const row of account.d1StorageAdaptiveGroups) {
    // 新しい順に並んでいるので、データベースごとに最初の値だけを使う
    if (!latestSize.has(row.dimensions.databaseId)) {
      latestSize.set(row.dimensions.databaseId, row.max.databaseSizeBytes);
    }
  }
  const d1 = account.d1AnalyticsAdaptiveGroups[0]?.sum;

  return {
    status: "ok",
    date,
    workersRequests: {
      used: account.workersInvocationsAdaptive[0]?.sum.requests ?? 0,
      limit: FREE_TIER.workersRequests,
    },
    workersAiNeurons: {
      used: account.aiInferenceAdaptiveGroups[0]?.sum.totalNeurons ?? 0,
      limit: FREE_TIER.workersAiNeurons,
    },
    d1RowsRead: { used: d1?.rowsRead ?? 0, limit: FREE_TIER.d1RowsRead },
    d1RowsWritten: { used: d1?.rowsWritten ?? 0, limit: FREE_TIER.d1RowsWritten },
    d1StorageBytes: {
      used: [...latestSize.values()].reduce((a, b) => a + b, 0),
      limit: FREE_TIER.d1StorageBytes,
    },
  };
}
