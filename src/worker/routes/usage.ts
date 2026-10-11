import { Hono } from "hono";
import { todayIn } from "../../shared/date";
import type { CloudflareUsage, UsageResponse } from "../../shared/schemas";
import { listAiUsage } from "../db/ai-usage";
import { fetchCloudflareUsage } from "../lib/cloudflare-usage";
import type { AppEnv } from "../types";

const HISTORY_DAYS = 7;

export const usageRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const date = todayIn(c.env.TIMEZONE);
  const limit = Number(c.env.AI_DAILY_LIMIT);
  const rows = await listAiUsage(c.get("db"), c.get("userId"), HISTORY_DAYS);
  // 上限を超えて断った呼び出しも数えているので、実際に AI を呼んだ回数（上限まで）に直す
  const history = rows.map((r) => ({ date: r.date, count: Math.min(r.count, limit) }));

  const { CF_ANALYTICS_TOKEN: token, CF_ACCOUNT_ID: accountId } = c.env;
  const cloudflare: CloudflareUsage =
    token && accountId
      ? await fetchCloudflareUsage({ token, accountId, fetcher: c.get("fetcher") })
      : { status: "unconfigured" };

  return c.json<UsageResponse>({
    ai: { date, today: { used: history.find((h) => h.date === date)?.count ?? 0, limit }, history },
    cloudflare,
  });
});
