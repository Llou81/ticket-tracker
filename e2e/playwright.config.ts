import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  workers: 1, // tests share one user and one board
  reporter: [["list"]],
  outputDir: "/tmp/test-results",
  use: {
    baseURL: process.env.BASE_URL ?? "http://frontend",
    viewport: { width: 1600, height: 1000 },
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 1000 } } }],
});
