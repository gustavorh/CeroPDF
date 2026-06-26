import path from "node:path";

import { defineConfig } from "vitest/config";

// Pure-logic tests only (no DOM). UI is verified manually in later plans.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
