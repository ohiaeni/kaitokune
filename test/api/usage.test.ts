import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { UsageResponse } from "../../src/shared/schemas";
import { resetDb, setup } from "../helpers";

beforeEach(resetDb);
describe("GET /api/usage", () => {
  const analyticsEnv = { CF_ANALYTICS_TOKEN: "token", CF_ACCOUNT_ID: "account" };

  /** GraphQL Analytics API のモック。受け取ったリクエストを記録する */
  function fakeAnalytics(response: Response | (() => never)) {
    const requests: Request[] = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return typeof response === "function" ? response() : response;
    }) as typeof fetch;
    return { fetcher, requests };
  }

  const analyticsData = {
    data: {
      viewer: {
        accounts: [
          {
            workersInvocationsAdaptive: [{ sum: { requests: 1234 } }],
            aiInferenceAdaptiveGroups: [{ sum: { totalNeurons: 56.5 } }],
            d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 789, rowsWritten: 12 } }],
            d1StorageAdaptiveGroups: [
              { dimensions: { databaseId: "a" }, max: { databaseSizeBytes: 3000 } },
              { dimensions: { databaseId: "b" }, max: { databaseSizeBytes: 500 } },
              { dimensions: { databaseId: "a" }, max: { databaseSizeBytes: 1000 } },
            ],
          },
        ],
      },
    },
    errors: null,
  };

  it("returns today's AI calls (capped at the limit) and skips Cloudflare when unconfigured", async () => {
    const { fetcher, requests } = fakeAnalytics(Response.json(analyticsData));
    const { request } = setup({}, { AI_DAILY_LIMIT: "2" }, fetcher);
    await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: [] } });
    await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: [] } });
    await request("/api/chat/next", { method: "POST", json: { date: "2026-10-08", qa: [] } });
    await env.DB.prepare("INSERT INTO ai_usage (user_id, date, count) VALUES (1, '2000-01-01', 1)").run();

    const body = await (await request("/api/usage")).json<UsageResponse>();
    expect(body.ai.today).toEqual({ used: 2, limit: 2 });
    expect(body.ai.history.map((h) => h.count)).toEqual([2, 1]);
    expect(body.ai.history[0].date).toBe(body.ai.date);
    expect(body.cloudflare).toEqual({ status: "unconfigured" });
    expect(requests).toHaveLength(0);
  });

  it("summarizes the account's free-tier usage from the GraphQL Analytics API", async () => {
    const { fetcher, requests } = fakeAnalytics(Response.json(analyticsData));
    const { request } = setup({}, analyticsEnv, fetcher);

    const { cloudflare } = await (await request("/api/usage")).json<UsageResponse>();
    expect(cloudflare).toMatchObject({
      status: "ok",
      workersRequests: { used: 1234, limit: 100_000 },
      workersAiNeurons: { used: 56.5, limit: 10_000 },
      d1RowsRead: { used: 789, limit: 5_000_000 },
      d1RowsWritten: { used: 12, limit: 100_000 },
      // データベースごとに最新（先頭）の値だけを合計する
      d1StorageBytes: { used: 3500, limit: 5_000_000_000 },
    });
    expect(requests[0].headers.get("authorization")).toBe("Bearer token");
    const { variables } = await requests[0].json<{ variables: { accountTag: string } }>();
    expect(variables.accountTag).toBe("account");
  });

  it("treats missing rows as zero usage", async () => {
    const empty = {
      data: {
        viewer: {
          accounts: [
            {
              workersInvocationsAdaptive: [],
              aiInferenceAdaptiveGroups: [],
              d1AnalyticsAdaptiveGroups: [],
              d1StorageAdaptiveGroups: [],
            },
          ],
        },
      },
    };
    const { request } = setup({}, analyticsEnv, fakeAnalytics(Response.json(empty)).fetcher);
    const { cloudflare } = await (await request("/api/usage")).json<UsageResponse>();
    expect(cloudflare).toMatchObject({ status: "ok", workersAiNeurons: { used: 0 }, d1StorageBytes: { used: 0 } });
  });

  it("reports Cloudflare errors without failing the whole response", async () => {
    const cases: [Response | (() => never), string][] = [
      [new Response("forbidden", { status: 403 }), "HTTP 403"],
      [Response.json({ data: null, errors: [{ message: "not authorized" }] }), "not authorized"],
      [
        () => {
          throw new Error("network down");
        },
        "接続できませんでした",
      ],
    ];
    for (const [response, message] of cases) {
      const { request } = setup({}, analyticsEnv, fakeAnalytics(response).fetcher);
      const res = await request("/api/usage");
      expect(res.status).toBe(200);
      const { cloudflare } = await res.json<UsageResponse>();
      expect(cloudflare.status).toBe("error");
      expect(cloudflare.status === "error" && cloudflare.message).toContain(message);
    }
  });
});
