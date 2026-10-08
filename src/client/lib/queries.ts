// API の取得・更新を TanStack Query のフックにまとめる。
// キャッシュの無効化・削除はここの更新用フックの中だけで行い、コンポーネントからは呼ばない
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Entry, SaveEntryRequest } from "../../shared/schemas";
import { api } from "./api";

const queryKeys = {
  entries: ["entries"] as const,
  entryList: (month?: string) => ["entries", "list", month ?? "all"] as const,
  entrySearch: (q: string) => ["entries", "search", q] as const,
  entry: (date: string) => ["entries", "detail", date] as const,
  notes: (date: string) => ["notes", date] as const,
  usage: ["usage"] as const,
};

/**
 * 更新が成功し、キャッシュを更新し終えたあとに呼ぶ処理。
 * useMutation に渡すので、mutate() の引数の onSuccess と違い、コンポーネントがアンマウントされても呼ばれる
 */
type MutationOptions<TData, TVariables> = { onSuccess?: (data: TData, variables: TVariables) => void };

export function useEntryList(month: string) {
  return useQuery({ queryKey: queryKeys.entryList(month), queryFn: () => api.listEntries(month) });
}

export function useEntrySearch(q: string) {
  return useQuery({ queryKey: queryKeys.entrySearch(q), queryFn: () => api.searchEntries(q) });
}

/** 日記がなければ data は null */
export function useEntry(date: string) {
  return useQuery({ queryKey: queryKeys.entry(date), queryFn: () => api.getEntry(date) });
}

export function useNotes(date: string) {
  return useQuery({ queryKey: queryKeys.notes(date), queryFn: () => api.listNotes(date) });
}

export function useUsage() {
  return useQuery({ queryKey: queryKeys.usage, queryFn: api.getUsage, staleTime: 60_000 });
}

type SaveEntryVariables = { date: string; payload: SaveEntryRequest };

export function useSaveEntry(options: MutationOptions<Entry, SaveEntryVariables> = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, payload }: SaveEntryVariables) => api.saveEntry(date, payload),
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.entries });
      options.onSuccess?.(data, variables);
    },
  });
}

export function useDeleteEntry(options: MutationOptions<void, string> = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => api.deleteEntry(date),
    onSuccess: async (data, date) => {
      // 一覧に戻る前に詳細のキャッシュを消し、削除済みの日記が一瞬表示されるのを防ぐ
      queryClient.removeQueries({ queryKey: queryKeys.entry(date) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.entries });
      options.onSuccess?.(data, date);
    },
  });
}

type ChangeEntryDateVariables = { date: string; newDate: string };

export function useChangeEntryDate(options: MutationOptions<Entry, ChangeEntryDateVariables> = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, newDate }: ChangeEntryDateVariables) => api.changeEntryDate(date, newDate),
    onSuccess: async (data, variables) => {
      queryClient.removeQueries({ queryKey: queryKeys.entry(variables.date) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.entries });
      options.onSuccess?.(data, variables);
    },
  });
}

export function useAddNote(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.addNote(date, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notes(date) }),
  });
}

export function useDeleteNote(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteNote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notes(date) }),
  });
}
