import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { msw } from "msw/vite";
import { defineConfig } from "vite";

/**
 * 開発サーバーでの AI の動かし方（package.json の scripts で DEV_AI を渡す）。
 * - mock（npm run dev。既定）: Cloudflare に接続せず、Worker の AI だけをモックする（src/worker/ai/mock.ts）
 * - remote（npm run dev:remote）: Workers AI をリモート（自分のアカウントの無料枠）で使う。`npx wrangler login` が必要
 * - gemini（npm run dev:local）: Cloudflare に接続せず、.dev.vars の Gemini だけで動かす
 */
const devAI = process.env.DEV_AI ?? "mock";

export default defineConfig(({ command, mode }) => ({
  resolve: {
    // shadcn/ui の部品が使うパスエイリアス（tsconfig.app.json の paths と合わせる）
    alias: { "@": fileURLToPath(new URL("./src/client", import.meta.url)) },
  },
  plugins: [
    // react プラグインより前に置く必要がある
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/client/routes",
      generatedRouteTree: "./src/client/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
    // npm run dev:mock（--mode mock）では Worker を起動せず、MSW の Service Worker で /api/* をモックする
    mode === "mock"
      ? msw({ mode: "worker-only" })
      : cloudflare({
          remoteBindings: devAI === "remote",
          // ビルドの出力（本番の設定）には入れないよう、開発サーバーのときだけ AI_MOCK を足す
          config:
            command === "serve" && devAI === "mock"
              ? (config) => {
                  config.vars = { ...config.vars, AI_MOCK: "1" };
                }
              : undefined,
        }),
  ],
}));
