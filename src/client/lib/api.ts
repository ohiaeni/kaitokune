import type {
  ApiErrorBody,
  ApiErrorCode,
  ComposeResponse,
  Entry,
  EntryDetail,
  EntrySummary,
  NextResponse,
  Note,
  QA,
  SaveEntryRequest,
  UsageResponse,
} from "../../shared/schemas";

type ApiErrorOptions = ErrorOptions & { status: number; code: ApiErrorCode | "network" };

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | "network";

  constructor(message: string, { status, code, ...options }: ApiErrorOptions) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
    });
  } catch (e) {
    throw new ApiError("通信できませんでした。ネットワークを確認してください", {
      status: 0,
      code: "network",
      cause: e,
    });
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(body?.message ?? `エラーが発生しました（${res.status}）`, {
      status: res.status,
      code: body?.error ?? "internal",
    });
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

  searchEntries: (q: string) => request<EntrySummary[]>(`/entries?q=${encodeURIComponent(q)}`),

  /** 日記がなければ null を返す */
  getEntry: async (date: string) => {
    try {
      return await request<EntryDetail>(`/entries/${date}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        return null;
      }
      throw e;
    }
  },

  saveEntry: (date: string, payload: SaveEntryRequest) =>
    request<Entry>(`/entries/${date}`, { method: "PUT", body: JSON.stringify(payload) }),

  changeEntryDate: (date: string, newDate: string) =>
    request<Entry>(`/entries/${date}`, { method: "PATCH", body: JSON.stringify({ date: newDate }) }),

  deleteEntry: (date: string) => request<void>(`/entries/${date}`, { method: "DELETE" }),

  listNotes: (date: string) => request<Note[]>(`/notes?date=${date}`),

  addNote: (date: string, body: string) =>
    request<Note>("/notes", { method: "POST", body: JSON.stringify({ date, body }) }),

  deleteNote: (id: number) => request<void>(`/notes/${id}`, { method: "DELETE" }),

  getUsage: () => request<UsageResponse>("/usage"),
};
