import type {
  ApiErrorBody,
  ApiErrorCode,
  ComposeResponse,
  Entry,
  EntryDetail,
  EntrySummary,
  NextResponse,
  QA,
  SaveEntryRequest,
  UsageResponse,
} from "../../shared/schemas";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | "network",
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
    });
  } catch {
    throw new ApiError(0, "network", "通信できませんでした。ネットワークを確認してください");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, body?.error ?? "internal", body?.message ?? `エラーが発生しました（${res.status}）`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  nextQuestion: (date: string, qa: QA[]) =>
    request<NextResponse>("/chat/next", { method: "POST", body: JSON.stringify({ date, qa }) }),

  compose: (date: string, qa: QA[]) =>
    request<ComposeResponse>("/chat/compose", { method: "POST", body: JSON.stringify({ date, qa }) }),

  listEntries: (month?: string) =>
    request<EntrySummary[]>(`/entries${month ? `?month=${encodeURIComponent(month)}` : ""}`),

  /** 日記がなければ null を返す */
  getEntry: async (date: string) => {
    try {
      return await request<EntryDetail>(`/entries/${date}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  saveEntry: (date: string, payload: SaveEntryRequest) =>
    request<Entry>(`/entries/${date}`, { method: "PUT", body: JSON.stringify(payload) }),

  changeEntryDate: (date: string, newDate: string) =>
    request<Entry>(`/entries/${date}`, { method: "PATCH", body: JSON.stringify({ date: newDate }) }),

  deleteEntry: (date: string) => request<void>(`/entries/${date}`, { method: "DELETE" }),

  getUsage: () => request<UsageResponse>("/usage"),
};

export const queryKeys = {
  entries: ["entries"] as const,
  entryList: (month?: string) => ["entries", "list", month ?? "all"] as const,
  entry: (date: string) => ["entries", "detail", date] as const,
  usage: ["usage"] as const,
};
