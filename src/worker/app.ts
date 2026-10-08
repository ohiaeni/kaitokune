import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import type { ApiErrorBody } from "../shared/schemas";
import { AccessError, type AccessVerifier, createAccessVerifier } from "./access";
import { createDiaryAI, createGeneratorsFromEnv, type DiaryAI } from "./ai";
import { AllProvidersFailedError } from "./ai/fallback";
import { users } from "./db/schema";
import type { Bindings } from "./env";
import { chatRoutes } from "./routes/chat";
import { entryRoutes } from "./routes/entries";
import { exportRoutes } from "./routes/export";
import { noteRoutes } from "./routes/notes";
import { usageRoutes } from "./routes/usage";
import type { AppEnv } from "./types";
import { DailyLimitError } from "./usage";

export type AppOptions = {
  /** テストではモックの AI を差し込む */
  createAI?: (env: Bindings) => DiaryAI;
  /** テストではモックの fetch を差し込む */
  fetcher?: typeof fetch;
};

/**
 * リクエストしたユーザーのメールアドレスを決める。
 * 本番では Access の JWT を検証し、ローカル開発では DEV_USER_EMAIL を使う。どちらもなければ誰も通さない
 */
async function authenticate(env: Bindings, token: string | undefined, verify: AccessVerifier): Promise<string> {
  const { ACCESS_TEAM_DOMAIN: teamDomain, ACCESS_AUD: aud, DEV_USER_EMAIL: devEmail } = env;
  if (teamDomain || aud) {
    if (!teamDomain || !aud) throw new AccessError("ACCESS_TEAM_DOMAIN and ACCESS_AUD must be set together");
    if (!token) throw new AccessError("missing Cf-Access-Jwt-Assertion header");
    return (await verify(token, { teamDomain, aud })).toLowerCase();
  }
  if (devEmail) return devEmail.toLowerCase();
  throw new AccessError("ACCESS_TEAM_DOMAIN / ACCESS_AUD (or DEV_USER_EMAIL for local development) is not set");
}

export function createApp({
  createAI = (env) => createDiaryAI(createGeneratorsFromEnv(env)),
  fetcher = fetch,
}: AppOptions = {}) {
  const verifyAccess = createAccessVerifier(fetcher);
  return new Hono<AppEnv>()
    .basePath("/api")
    .use(async (c, next) => {
      const email = await authenticate(c.env, c.req.header("cf-access-jwt-assertion"), verifyAccess);
      const db = drizzle(c.env.DB);
      // Access を通っても、users に登録していない人には使わせない
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(sql`lower(${users.email})`, email));
      if (!user) {
        console.warn(`unregistered user: ${email}`);
        return c.json<ApiErrorBody>(
          { error: "forbidden", message: `${email} はまだ登録されていません。管理者に登録を頼んでください` },
          403,
        );
      }
      c.set("userId", user.id);
      c.set("db", db);
      c.set("ai", createAI(c.env));
      c.set("fetcher", fetcher);
      await next();
    })
    .route("/chat", chatRoutes)
    .route("/entries", entryRoutes)
    .route("/export", exportRoutes)
    .route("/notes", noteRoutes)
    .route("/usage", usageRoutes)
    .notFound((c) => c.json<ApiErrorBody>({ error: "not_found", message: "Not Found" }, 404))
    .onError((err, c) => {
      if (err instanceof AccessError) {
        console.warn(`access denied: ${err.message}`);
        return c.json<ApiErrorBody>({ error: "unauthorized", message: "ログインを確認できませんでした" }, 401);
      }
      if (err instanceof DailyLimitError) {
        return c.json<ApiErrorBody>(
          { error: "daily_limit", message: `今日の AI 利用上限（${err.limit} 回）に達しました` },
          429,
        );
      }
      if (err instanceof AllProvidersFailedError) {
        return c.json<ApiErrorBody>(
          { error: "ai_unavailable", message: "AI に接続できませんでした。時間をおいて試してください" },
          502,
        );
      }
      console.error(err);
      return c.json<ApiErrorBody>({ error: "internal", message: "Internal Server Error" }, 500);
    });
}
