import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { msw } from "msw/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
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
      : // LOCAL_ONLY=1 のときは Cloudflare に接続しない（Workers AI は使えず、Gemini だけで動かす）
        cloudflare({ remoteBindings: process.env.LOCAL_ONLY !== "1" }),
  ],
}));
