import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * AEG-11-2: end-to-end smoke test.
 *
 * Loads the built extension into a persistent Chromium context, opens the
 * Gmail-shaped fixture page, and verifies the generic hover scanner renders
 * verdict badges on suspicious / phishing links and leaves clean links alone.
 *
 * Build precondition: `pnpm build` must have produced `.output/chrome-mv3/`.
 * The Playwright config doesn't `pnpm build` for you so you can iterate
 * without paying the build cost on every spec run.
 */

const EXTENSION_PATH = path.resolve(__dirname, "..", "..", ".output", "chrome-mv3");
const FIXTURE_URL = "http://127.0.0.1:4173/gmail-message.html";

let context: BrowserContext;
let page: Page;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-sandbox",
    ],
  });
  page = await context.newPage();
});

test.afterAll(async () => {
  await context.close();
});

test("the extension loads and exposes the welcome page", async () => {
  // onInstalled fires during context creation (beforeAll), so the welcome tab
  // may already be open by the time this test runs. Register the listener
  // first to close the race window, then check existing pages.
  const futureWelcomePage = context.waitForEvent("page", { timeout: 15_000 });
  const existingWelcome = context.pages().find((p) => p.url().includes("welcome"));
  const welcomePage = existingWelcome ?? (await futureWelcomePage);

  await welcomePage.waitForLoadState("domcontentloaded");
  await expect(welcomePage.locator("body")).toContainText("Gorgon Eye");
  await welcomePage.close();
});

test("hover scanner badges a phishing link and a suspicious link, leaves safe alone", async () => {
  await page.goto(FIXTURE_URL);
  await page.waitForLoadState("networkidle");

  const badges = page.locator(".aegis-badge");

  // Hover each link and pause long enough for the 250 ms debounce to fire
  // before moving on — otherwise each new hover cancels the previous timer
  // and only the last link ever gets analyzed.
  const phishLink = page.locator('a[href*="paypa1.example"]').first();
  await phishLink.hover();
  await page.waitForTimeout(500);

  const susLink = page.locator('a[href*="/r?to="]').first();
  await susLink.hover();
  await page.waitForTimeout(500);

  const safeLink = page.locator('a[href*="github.com"]').first();
  await safeLink.hover();
  await page.waitForTimeout(500);

  // Wait for exactly 2 badges (phishing + suspicious); safe link produces none.
  await expect(badges).toHaveCount(2, { timeout: 15_000 });

  // The badges should show Phishing and Suspicious (in either order).
  const texts = await badges.allTextContents();
  const normalised = new Set(texts.map((t) => t.trim()));
  expect(normalised.has("Phishing")).toBe(true);
  expect(normalised.has("Suspicious")).toBe(true);
});

test("clicking a phishing badge opens an inline popover with the URL and signals", async () => {
  // Re-use the same page; badges from the prior test are still there.
  const phishBadge = page
    .locator(".aegis-badge")
    .filter({ hasText: "Phishing" })
    .first();
  await phishBadge.click();

  const popover = page.locator(".aegis-popover");
  await expect(popover).toBeVisible({ timeout: 5_000 });
  await expect(popover).toContainText("paypa1.example");
  await expect(popover).toContainText("Phishing");
  // Top signals for that fixture include typosquatting + credential keywords.
  const text = (await popover.textContent()) ?? "";
  expect(/typosquat/i.test(text) || /credential/i.test(text)).toBe(true);

  // Close it.
  await popover.locator("button", { hasText: "Close" }).click();
  await expect(popover).toHaveCount(0);
});
