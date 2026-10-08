import { useState } from "react";
import { loadJson, saveJson } from "../lib/storage";

export type EntriesView = "list" | "calendar";

// 詳細画面から「一覧に戻る」で戻っても同じ表示になるよう、URL ではなく localStorage に持たせる
const VIEW_KEY = "kaitokune:entries-view";

/** 日記の一覧の表示（一覧 / カレンダー）。選んだ表示は localStorage に保存する */
export function useEntriesView(): [EntriesView, (view: EntriesView) => void] {
  const [view, setView] = useState<EntriesView>(() =>
    loadJson<EntriesView>(VIEW_KEY) === "calendar" ? "calendar" : "list",
  );
  const changeView = (next: EntriesView) => {
    setView(next);
    saveJson(VIEW_KEY, next);
  };
  return [view, changeView];
}
