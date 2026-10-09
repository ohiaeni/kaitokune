// npm run dev:mock のときだけ main.tsx から読み込み、Service Worker で /api/* をモックする
import { setupWorker } from "msw/browser";
import { createHandlers } from "./handlers";
import { loadScenario, SCENARIOS, type Scenario, saveScenario } from "./scenarios";

/** 画面左下に、シナリオを切り替えるセレクトボックスを置く（アプリの React ツリーの外に置く） */
function mountScenarioSwitcher(current: Scenario): void {
  const select = document.createElement("select");
  select.setAttribute("aria-label", "モックのシナリオ");
  select.style.cssText =
    "position:fixed;left:8px;bottom:8px;z-index:9999;font-size:12px;padding:2px 4px;opacity:0.8;color:#000;background:#fff;border:1px solid #999;border-radius:4px";
  for (const { value, label } of SCENARIOS) {
    select.add(new Option(`モック: ${label}`, value, false, value === current));
  }
  select.addEventListener("change", () => {
    saveScenario(select.value as Scenario);
    location.reload();
  });
  document.body.append(select);
}

export async function startMockWorker(): Promise<void> {
  const scenario = loadScenario();
  const worker = setupWorker(...createHandlers(scenario));
  // /api/* 以外（Vite が返すソースやアセット）はそのまま通す
  await worker.start({ onUnhandledFrame: "bypass", quiet: true });
  mountScenarioSwitcher(scenario);
}
