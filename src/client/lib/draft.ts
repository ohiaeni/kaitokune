import type { QA } from "../../shared/schemas";
import { loadJson, removeItem, saveJson } from "./storage";

/** 会話の途中経過。リロードしても続きから再開できるよう localStorage に保存する */
export type Draft = {
  qa: QA[];
  /** 回答待ちの質問 */
  pending: string | null;
  /** 質問が終わり、日記にまとめる段階 */
  done: boolean;
  /** AI がまとめた日記本文 */
  composed: string | null;
};

export const EMPTY_DRAFT: Draft = { qa: [], pending: null, done: false, composed: null };

const draftKey = (date: string) => `kaitokune:draft:${date}`;

export function loadDraft(date: string): Draft | null {
  return loadJson<Draft>(draftKey(date));
}

export function saveDraft(date: string, draft: Draft): void {
  saveJson(draftKey(date), draft);
}

export function removeDraft(date: string): void {
  removeItem(draftKey(date));
}
