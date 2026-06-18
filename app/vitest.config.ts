import { defineConfig } from "vitest/config";
import Vue from "@vitejs/plugin-vue";
import { resolve } from "path";

/**
 * Plain vitest config (no `@nuxt/test-utils` bootstrap).
 *
 * Background: `defineVitestConfig` from `@nuxt/test-utils/config` boots Nuxt
 * eagerly so it can pre-populate `runtimeConfig` + nuxt-style env. In our app
 * that booting path crashes with `DOMException: DataCloneError` because some
 * value reachable from the resolved Nuxt config isn't structured-cloneable.
 *
 * The unit tests under `tests/frontend/**` never import from `#imports`,
 * `nuxt/app` or any Nuxt runtime helper, so we don't actually need the Nuxt
 * environment here. Falling back to plain `defineConfig` keeps Vue SFC support
 * (via `@vitejs/plugin-vue`) and the `@components`/`@models`/`@utils`/`@stores`
 * aliases.
 */
export default defineConfig({
  plugins: [Vue()],
  resolve: {
    alias: {
      "@components": resolve(__dirname, "./components"),
      "@models": resolve(__dirname, "./types/models"),
      "@utils": resolve(__dirname, "./utils"),
      "@stores": resolve(__dirname, "./stores"),
      "@constants": resolve(__dirname, "./constants"),
      "@composables": resolve(__dirname, "./composables"),
      "@pages": resolve(__dirname, "./pages"),
      "@adapters": resolve(__dirname, "./adapters"),
      // Nuxt default aliases — needed by composables/stores that use `~/...` or `@/...`
      "~": resolve(__dirname),
      "@": resolve(__dirname),
      "~~": resolve(__dirname),
      "@@": resolve(__dirname),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["html", "text"],
    },
  },
});
