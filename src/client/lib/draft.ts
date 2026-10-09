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
  /** 日記と一緒に AI が提案した、明日やってみること */
  suggestions: string[];
};

export const EMPTY_DRAFT: Draft = { qa: [], pending: null, done: false, composed: null, suggestions: [] };

const draftKey = (date: string) => `kaitokune:draft:${date}`;

export function loadDraft(date: string): Draft | null {
  const draft = loadJson<Draft>(draftKey(date));
  // suggestions を足す前に保存された書きかけの会話にも対応する
  return draft && { ...EMPTY_DRAFT, ...draft };
}

export function saveDraft(date: string, draft: Draft): void {
  saveJson(draftKey(date), draft);
}

export function removeDraft(date: string): void {
  removeItem(draftKey(date));
}
