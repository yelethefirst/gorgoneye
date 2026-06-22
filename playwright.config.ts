import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Playwright E2E config (AEG-11-2).
 *
 * The Vitest unit suite covers logic + DOM units. This suite covers the only
 * thing Vitest can't: the loaded extension actually rendering its content
 * script into a real Chromium tab. We:
 *   - run `pnpm build` before the test (CI handles this; local devs do too).
 *   - serve `tests/fixtures/` over http://127.0.0.1:4173 so the generic
 *     content script can inject (chrome content scripts don't run on file://).
 *   - launch a persistent Chromium context with the built extension loaded
 *     via --load-extension (Chromium-only, headed by default).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/.results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    headless: false, // extensions require a headed context
  },
  webServer: {
    command: "pnpm exec http-server tests/fixtures -p 4173 -s -c-1",
    url: "http://127.0.0.1:4173/gmail-message.html",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium-extension",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
      metadata: {
        extensionPath: path.resolve(__dirname, ".output/chrome-mv3"),
      },
    },
  ],
});
