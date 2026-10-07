import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { DiaryAI } from "./ai";
import type { Bindings } from "./env";

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    db: DrizzleD1Database;
    ai: DiaryAI;
  };
};
