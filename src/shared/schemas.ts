import { z } from "zod";
import { DATE_PATTERN, MAX_QUESTIONS, MONTH_PATTERN } from "./constants";

export * from "./constants";

export const dateSchema = z.string().regex(DATE_PATTERN, "YYYY-MM-DD 形式で指定してください");
export const monthSchema = z.string().regex(MONTH_PATTERN, "YYYY-MM 形式で指定してください");

export const qaSchema = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(1000),
});
export type QA = z.infer<typeof qaSchema>;

export const nextRequestSchema = z.object({
  date: dateSchema,
  qa: z.array(qaSchema).max(MAX_QUESTIONS),
});
export type NextRequest = z.infer<typeof nextRequestSchema>;
export type NextResponse = { question: string } | { done: true };

export const composeRequestSchema = z.object({
  date: dateSchema,
  qa: z.array(qaSchema).min(1).max(MAX_QUESTIONS),
});
export type ComposeRequest = z.infer<typeof composeRequestSchema>;
export type ComposeResponse = { body: string };

export const moodSchema = z.number().int().min(1).max(5);

export const saveEntryRequestSchema = z.object({
  body: z.string().trim().min(1).max(10000),
  mood: moodSchema.nullable().optional(),
  qa: z.array(qaSchema).max(MAX_QUESTIONS).optional(),
});
export type SaveEntryRequest = z.infer<typeof saveEntryRequestSchema>;

export type Entry = {
  date: string;
  body: string;
  mood: number | null;
  createdAt: number;
  updatedAt: number;
};
export type EntrySummary = { date: string; excerpt: string; mood: number | null };
export type EntryDetail = { entry: Entry; qa: QA[] };

export type ApiErrorCode = "daily_limit" | "ai_unavailable" | "not_found" | "invalid_request" | "internal";
export type ApiErrorBody = { error: ApiErrorCode; message: string };
