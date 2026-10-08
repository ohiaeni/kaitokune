import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      // テストでは AI をモックするので、リモート（Cloudflare アカウント）には接続しない
      remoteBindings: false,
      miniflare: {
        bindings: { TEST_MIGRATIONS: await readD1Migrations("./migrations") },
      },
    })),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/apply-migrations.ts"],
    // npm run test:coverage で計測する。@cloudflare/vitest-pool-workers は istanbul にだけ対応している
    coverage: {
      provider: "istanbul",
      // テストから読み込まれないファイル（フロントエンドなど）も 0% として表に出す
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/client/routeTree.gen.ts", "**/*.d.ts"],
      reporter: ["text", "json-summary", "html"],
    },
  },
});
