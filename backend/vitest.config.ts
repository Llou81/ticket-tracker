import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    // All test files share one database.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
