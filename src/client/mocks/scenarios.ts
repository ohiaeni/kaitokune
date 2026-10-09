import { loadJson, saveJson } from "../lib/storage";

/** 画面で確かめたい状態。画面左下の切り替えで選び、ページを読み込み直すと反映される */
export const SCENARIOS = [
  { value: "normal", label: "標準（日記が数件）" },
  { value: "empty", label: "日記が 0 件" },
  { value: "many", label: "日記が大量（1 年分）" },
  { value: "ai-error", label: "AI に接続できない" },
  { value: "daily-limit", label: "AI の利用上限に到達" },
  { value: "slow", label: "応答が遅い（2 秒）" },
  { value: "offline", label: "通信できない" },
] as const;

export type Scenario = (typeof SCENARIOS)[number]["value"];

const STORAGE_KEY = "kaitokune:mock-scenario";

export function loadScenario(): Scenario {
  const saved = loadJson<string>(STORAGE_KEY);
  return SCENARIOS.find((s) => s.value === saved)?.value ?? "normal";
}

export function saveScenario(scenario: Scenario): void {
  saveJson(STORAGE_KEY, scenario);
}
