import { desc } from "drizzle-orm";
import { Hono } from "hono";
import type { CloudflareUsage, UsageResponse } from "../../shared/schemas";
import { fetchCloudflareUsage } from "../cloudflare-usage";
import { aiUsage } from "../db/schema";
import type { AppEnv } from "../types";
import { todayIn } from "../usage";

const HISTORY_DAYS = 7;

export const usageRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const date = todayIn(c.env.TIMEZONE);
  const limit = Number(c.env.AI_DAILY_LIMIT);
  const rows = await c.get("db").select().from(aiUsage).orderBy(desc(aiUsage.date)).limit(HISTORY_DAYS);
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
