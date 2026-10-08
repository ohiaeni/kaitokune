import { drizzle } from "drizzle-orm/d1";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";

/** DB と外部 API の呼び出しに使う fetch を Context に入れる */
export function injectContext(fetcher: typeof fetch): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set("db", drizzle(c.env.DB));
    c.set("fetcher", fetcher);
    await next();
  };
}
