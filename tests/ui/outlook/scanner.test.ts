// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractUnscannedAnchors,
  startOutlookScanner,
} from "../../../src/ui/outlook/scanner";
import { analyzeUrl } from "../../../src/detection/analyzeUrl";
import { BADGE_CLASS } from "../../../src/ui/badges/badge";

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setMessageBody(html: string) {
  document.body.innerHTML = `<div role="main">${html}</div>`;
}

describe("extractUnscannedAnchors (Outlook)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("picks up anchors inside [role=main]", () => {
    setMessageBody(`<a href="https://example.com/a">x</a>`);
    expect(extractUnscannedAnchors(document)).toHaveLength(1);
  });

  it("falls back to the legacy [role=region][aria-label*=Reading] surface", () => {
    document.body.innerHTML = `
      <div role="region" aria-label="Reading pane">
        <a href="https://paypa1.example/login">x</a>
      </div>
    `;
    const out = extractUnscannedAnchors(document);
    expect(out).toHaveLength(1);
    expect(out[0]!.href).toContain("paypa1.example");
  });

  it("skips already-tagged anchors", () => {
    setMessageBody(`
      <a href="https://a.example/" data-aegis-scanned="complete">old</a>
      <a href="https://b.example/">new</a>
    `);
    const out = extractUnscannedAnchors(document);
    expect(out).toHaveLength(1);
    expect(out[0]!.href).toContain("b.example");
  });
});

describe("startOutlookScanner", () => {
  let analyze: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = "";
    analyze = vi.fn(async (url: string) =>
      analyzeUrl({
        url,
        context: { surface: "outlook", userGesture: "email_open" },
      }),
    );
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders badges for safe + phishing on initial scan", async () => {
    setMessageBody(`
      <a href="https://github.com/aegishield">safe</a>
      <a href="https://paypa1.example/login">phishing</a>
    `);
    const handle = startOutlookScanner({ root: document, analyze });
    await handle.scan();

    const badges = document.querySelectorAll(`.${BADGE_CLASS}`);
    expect(badges).toHaveLength(2);
    const labels = Array.from(badges).map((b) => b.textContent);
    expect(labels).toEqual(expect.arrayContaining(["Safe", "Phishing"]));
    handle.stop();
  });

  it("dedupes repeated scans of the same anchor", async () => {
    setMessageBody(`<a href="https://paypa1.example/login">x</a>`);
    const handle = startOutlookScanner({ root: document, analyze });
    await handle.scan();
    await handle.scan();
    expect(analyze).toHaveBeenCalledTimes(1);
    handle.stop();
  });

  it("picks up anchors added after start (SPA navigation)", async () => {
    setMessageBody(`<a href="https://news.ycombinator.com/">first</a>`);
    const handle = startOutlookScanner({ root: document, analyze });
    await handle.scan();
    expect(analyze).toHaveBeenCalledTimes(1);

    const root = document.querySelector('[role="main"]')!;
    const a = document.createElement("a");
    a.href = "https://en.wikipedia.org/wiki/Phishing";
    a.textContent = "added";
    root.appendChild(a);

    await flush();
    await handle.scan();
    expect(analyze).toHaveBeenCalledTimes(2);
    handle.stop();
  });

  it("stop() prevents further scans", async () => {
    setMessageBody(`<a href="https://paypa1.example/login">x</a>`);
    const handle = startOutlookScanner({ root: document, analyze });
    handle.stop();
    await handle.scan();
    expect(analyze).not.toHaveBeenCalled();
  });
});
