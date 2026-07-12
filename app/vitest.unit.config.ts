import { defineConfig } from "vitest/config";
import { resolve } from "path";

/** Nuxt 非依存の adapter 単体テスト用 */
export default defineConfig({
  resolve: {
    alias: {
      "@adapters": resolve(__dirname, "./adapters"),
      "@models": resolve(__dirname, "./types/models"),
      "@utils": resolve(__dirname, "./utils"),
      "@constants": resolve(__dirname, "./constants"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/frontend/adapters/**/*.test.ts",
      "tests/frontend/utils/**/*.test.ts",
    ],
  },
});
