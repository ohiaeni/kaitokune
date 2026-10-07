import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
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
    // LOCAL_ONLY=1 のときは Cloudflare に接続しない（Workers AI は使えず、Gemini だけで動かす）
    cloudflare({ remoteBindings: process.env.LOCAL_ONLY !== "1" }),
  ],
});
