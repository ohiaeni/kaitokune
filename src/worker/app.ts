import { Hono } from "hono";
import type { ApiErrorBody } from "../shared/schemas";
import { createDiaryAI, createGeneratorsFromEnv, type DiaryAI } from "./ai";
import type { Bindings } from "./env";
import { handleError } from "./lib/errors";
import { aiQuota } from "./middleware/ai-quota";
import { auth } from "./middleware/auth";
import { createAccessVerifier } from "./middleware/cloudflare-access";
import { injectContext } from "./middleware/context";
import { chatRoutes } from "./routes/chat";
import { entryRoutes } from "./routes/entries";
import { exportRoutes } from "./routes/export";
import { noteRoutes } from "./routes/notes";
import { usageRoutes } from "./routes/usage";
import type { AppEnv } from "./types";

export type AppOptions = {
  /** テストではモックの AI を差し込む */
  createAI?: (env: Bindings) => DiaryAI;
  /** テストではモックの fetch を差し込む */
  fetcher?: typeof fetch;
};

export function createApp({
  createAI = (env) => createDiaryAI(createGeneratorsFromEnv(env)),
  fetcher = fetch,
}: AppOptions = {}) {
  return new Hono<AppEnv>()
    .basePath("/api")
    .use(injectContext(fetcher))
    .use(auth(createAccessVerifier(fetcher)))
    .use(aiQuota(createAI))
    .route("/chat", chatRoutes)
    .route("/entries", entryRoutes)
    .route("/export", exportRoutes)
    .route("/notes", noteRoutes)
    .route("/usage", usageRoutes)
    .notFound((c) => c.json<ApiErrorBody>({ error: "not_found", message: "Not Found" }, 404))
    .onError(handleError);
}
