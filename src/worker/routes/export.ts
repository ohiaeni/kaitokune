import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { todayIn } from "../../shared/date";
import { type ExportFile, exportQuerySchema } from "../../shared/schemas";
import { loadAllForExport } from "../db/entries";
import { toMarkdown } from "../export/markdown";
import { validationHook } from "../lib/validation";
import type { AppEnv } from "../types";

export const exportRoutes = new Hono<AppEnv>().get(
  "/",
  zValidator("query", exportQuerySchema, validationHook),
  async (c) => {
    const { format } = c.req.valid("query");
    const file: ExportFile = {
      format: "kaitokune",
      version: 2,
      exportedAt: new Date().toISOString(),
      entries: await loadAllForExport(c.get("db"), c.get("userId")),
    };
    const filename = `kaitokune-${todayIn(c.env.TIMEZONE)}.${format === "json" ? "json" : "md"}`;
    c.header("content-disposition", `attachment; filename="${filename}"`);
    c.header("cache-control", "no-store");
    if (format === "json") {
      return c.json(file);
    }
    c.header("content-type", "text/markdown; charset=utf-8");
    return c.body(toMarkdown(file));
  },
);
