// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startHoverScanner } from "../../../src/ui/generic/hoverScanner";
import { BADGE_CLASS } from "../../../src/ui/badges/badge";
import { analyzeUrl } from "../../../src/detection/analyzeUrl";
import { sha256Hex } from "../../../src/shared/hash";
import type { AnalysisResult } from "../../../src/shared/verdict";

const DEBOUNCE = 5;

function setBody(html: string) {
  document.body.innerHTML = html;
}

function hover(selector: string) {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) throw new Error(`hover target not found: ${selector}`);
  target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeResult(url: string, verdict: AnalysisResult["verdict"]): Promise<AnalysisResult> {
  return {
    analysisId: "an_test",
    urlDisplay: url,
    urlHash: await sha256Hex(url),
    verdict,
    confidence: verdict === "safe" ? 0.1 : verdict === "suspicious" ? 0.5 : 0.9,
    createdAt: new Date(0).toISOString(),
    expiresAt: new Date(60_000).toISOString(),
    timings: { totalMs: 1 },
    layers: {
      rules: { layer: "rules", status: "complete", score: 0.5, durationMs: 1, signals: [] },
    },
    firedSignals: [],
    privacy: {
      emailContentLeftDevice: false,
      fullUrlSentToAegisService: false,
      fullUrlSentToThreatIntel: false,
      hashPrefixSentToThreatIntel: false,
      targetOriginContacted: false,
      telemetrySent: false,
      auditRecordIds: [],
    },
    unavailableLayers: [],
  };
}

describe("startHoverScanner", () => {
  let analyze: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    document.body.innerHTML = "";
    analyze = vi.fn(async (url: string) =>
      analyzeUrl({ url, context: { surface: "generic_page", userGesture: "hover" } }),
    );
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("invokes analyze after the debounce window", async () => {
    setBody(`<a id="t" href="https://paypa1.example/login">x</a>`);
    const handle = startHoverScanner({
      root: document,
      analyze,
      isTrusted: () => false,
      debounceMs: DEBOUNCE,
    });
    hover("#t");
    expect(analyze).not.toHaveBeenCalled();
    await wait(DEBOUNCE + 10);
    expect(analyze).toHaveBeenCalledTimes(1);
    handle.stop();
  });

  it("dedupes the same href across repeated hovers in the same session", async () => {
    setBody(`<a id="t" href="https://paypa1.example/login">x</a>`);
    const handle = startHoverScanner({
      root: document,
      analyze,
      isTrusted: () => false,
      debounceMs: DEBOUNCE,
    });
    hover("#t");
    await wait(DEBOUNCE + 10);
    hover("#t");
    await wait(DEBOUNCE + 10);
    expect(analyze).toHaveBeenCalledTimes(1);
    handle.stop();
  });

  it("skips trusted domains entirely (no analyze, no badge)", async () => {
    setBody(`<a id="t" href="https://github.com/aegishield">x</a>`);
    const handle = startHoverScanner({
      root: document,
      analyze,
      isTrusted: (url) => url.includes("github.com"),
      debounceMs: DEBOUNCE,
    });
    hover("#t");
    await wait(DEBOUNCE + 10);
    expect(analyze).not.toHaveBeenCalled();
    expect(document.querySelector(`.${BADGE_CLASS}`)).toBeNull();
    handle.stop();
  });

  it("does NOT render a badge for a safe verdict", async () => {
    analyze = vi.fn(async (url: string) => makeResult(url, "safe"));
    setBody(`<a id="t" href="https://benign.example/">x</a>`);
    const handle = startHoverScanner({
      root: document,
      analyze,
      isTrusted: () => false,
      debounceMs: DEBOUNCE,
    });
    hover("#t");
    await wait(DEBOUNCE + 10);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(document.querySelector(`.${BADGE_CLASS}`)).toBeNull();
    handle.stop();
  });

  it("renders a badge for a suspicious / phishing verdict", async () => {
    analyze = vi.fn(async (url: string) => makeResult(url, "phishing"));
    setBody(`<a id="t" href="https://paypa1.example/login">x</a>`);
    const handle = startHoverScanner({
      root: document,
      analyze,
      isTrusted: () => false,
      debounceMs: DEBOUNCE,
    });
    hover("#t");
    await wait(DEBOUNCE + 10);
    const badge = document.querySelector<HTMLElement>(`.${BADGE_CLASS}`);
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("Phishing");
    handle.stop();
  });

  it("enforces the sliding-window rate limit", async () => {
    let t = 1_000_000;
    const handle = startHoverScanner({
      root: document,
      analyze,
      isTrusted: () => false,
      debounceMs: 1,
      maxScansPerWindow: { count: 2, windowMs: 1000 },
      now: () => t,
    });
    setBody(
      `<a id="a" href="https://example.com/1">1</a>
       <a id="b" href="https://example.com/2">2</a>
       <a id="c" href="https://example.com/3">3</a>`,
    );
    for (const id of ["a", "b", "c"]) {
      hover(`#${id}`);
      await wait(5);
    }
    expect(analyze).toHaveBeenCalledTimes(2);
    // After the window passes, the third hover would scan, but dedupe still
    // blocks re-hovers — issue a new href instead.
    t += 1500;
    setBody(`<a id="d" href="https://example.com/4">4</a>`);
    hover("#d");
    await wait(5);
    expect(analyze).toHaveBeenCalledTimes(3);
    handle.stop();
  });

  it("stop() removes the listener and cancels pending scans", async () => {
    setBody(`<a id="t" href="https://paypa1.example/login">x</a>`);
    const handle = startHoverScanner({
      root: document,
      analyze,
      isTrusted: () => false,
      debounceMs: DEBOUNCE,
    });
    hover("#t");
    handle.stop();
    await wait(DEBOUNCE + 10);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("ignores non-http(s) anchors", async () => {
    setBody(
      `<a id="m" href="mailto:alice@example.com">m</a>
       <a id="j" href="javascript:alert(1)">j</a>`,
    );
    const handle = startHoverScanner({
      root: document,
      analyze,
      isTrusted: () => false,
      debounceMs: DEBOUNCE,
    });
    hover("#m");
    hover("#j");
    await wait(DEBOUNCE + 10);
    expect(analyze).not.toHaveBeenCalled();
    handle.stop();
  });
});
