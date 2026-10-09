import { z } from "zod";
import {
  DATE_PATTERN,
  MAX_QUESTIONS,
  MAX_SUGGESTIONS,
  MONTH_PATTERN,
  NOTE_MAX_LENGTH,
  SEARCH_QUERY_MAX_LENGTH,
  SUGGESTION_MAX_LENGTH,
} from "./constants";

export * from "./constants";

export const dateSchema = z.string().regex(DATE_PATTERN, "YYYY-MM-DD 形式で指定してください");
export const monthSchema = z.string().regex(MONTH_PATTERN, "YYYY-MM 形式で指定してください");

export const searchQuerySchema = z.string().trim().min(1).max(SEARCH_QUERY_MAX_LENGTH);

const qaSchema = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(1000),
});
export type QA = z.infer<typeof qaSchema>;

export const nextRequestSchema = z.object({
  date: dateSchema,
  qa: z.array(qaSchema).max(MAX_QUESTIONS),
});
export type NextResponse = { question: string } | { done: true };

export const composeRequestSchema = z.object({
  date: dateSchema,
  qa: z.array(qaSchema).min(1).max(MAX_QUESTIONS),
});
export type ComposeResponse = {
  body: string;
  /** 明日やってみること（AI が提案できなかったときは空） */
  suggestions: string[];
};

const suggestionsSchema = z.array(z.string().trim().min(1).max(SUGGESTION_MAX_LENGTH)).max(MAX_SUGGESTIONS);

const moodSchema = z.number().int().min(1).max(5);

export const saveEntryRequestSchema = z.object({
  body: z.string().trim().min(1).max(10000),
  mood: moodSchema.nullable().optional(),
  qa: z.array(qaSchema).max(MAX_QUESTIONS).optional(),
  suggestions: suggestionsSchema.optional(),
});
export type SaveEntryRequest = z.infer<typeof saveEntryRequestSchema>;

export const changeDateRequestSchema = z.object({ date: dateSchema });

export type Entry = {
  date: string;
  body: string;
  mood: number | null;
  /** 日記と一緒に AI が提案した、明日やってみること */
  suggestions: string[];
  createdAt: number;
  updatedAt: number;
};
export type EntrySummary = { date: string; excerpt: string; mood: number | null };
export type EntryDetail = { entry: Entry; qa: QA[] };

export const exportQuerySchema = z.object({ format: z.enum(["json", "markdown"]).default("json") });

/** JSON でエクスポートしたファイルの中身。将来インポートに使うため、形を変えたら version を上げる */
export type ExportFile = {
  format: "kaitokune";
  version: 2;
  /** エクスポートした日時（ISO 8601） */
  exportedAt: string;
  entries: (Entry & { qa: QA[] })[];
};

export const createNoteRequestSchema = z.object({
  date: dateSchema,
  body: z.string().trim().min(1).max(NOTE_MAX_LENGTH),
});
export type Note = { id: number; date: string; body: string; createdAt: number };

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "daily_limit"
  | "ai_unavailable"
  | "not_found"
  | "conflict"
  | "invalid_request"
  | "internal";
export type ApiErrorBody = { error: ApiErrorCode; message: string };

export type UsageMeter = { used: number; limit: number };
export type CloudflareUsage =
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      /** 集計した日（UTC。Cloudflare の無料枠は 00:00 UTC にリセットされる） */
      date: string;
      workersRequests: UsageMeter;
      workersAiNeurons: UsageMeter;
      d1RowsRead: UsageMeter;
      d1RowsWritten: UsageMeter;
      d1StorageBytes: UsageMeter;
    };
export type UsageResponse = {
  /** アプリ内で数えている、ログインしているユーザーの AI の呼び出し回数（AI_DAILY_LIMIT による 1 人あたりの上限） */
  ai: { date: string; today: UsageMeter; history: { date: string; count: number }[] };
  cloudflare: CloudflareUsage;
};
