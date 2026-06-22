import type { AnalysisResult } from "../../shared/verdict";
import { renderBadge } from "../badges/badge";

export interface HoverScannerOptions {
  root: Document;
  analyze(url: string): Promise<AnalysisResult>;
  /** Synchronous trust check. Trusted URLs are skipped entirely (no analyze call). */
  isTrusted(url: string): boolean;
  /** Debounce window before a hovered anchor is scanned. Default 250 ms. */
  debounceMs?: number;
  /** Bounded scan-rate guard. Default: 20 scans per 5 s. */
  maxScansPerWindow?: { count: number; windowMs: number };
  /** Inject for deterministic tests. Defaults to `Date.now`. */
  now?: () => number;
}

export interface HoverScannerHandle {
  stop(): void;
}

/**
 * Passive hover-based scanner for arbitrary web pages.
 *
 * Differences vs the Gmail scanner:
 *   - Driven by `mouseover` events instead of a MutationObserver.
 *   - Only renders a badge when the verdict is NOT safe — generic pages
 *     should be quiet by default.
 *   - Per-page-session dedupe by href.
 *   - Trusted-domain allowlist short-circuits before any analyze call.
 *   - Sliding-window rate limit so a malicious page can't trigger a flood.
 */
export function startHoverScanner(opts: HoverScannerOptions): HoverScannerHandle {
  const debounceMs = opts.debounceMs ?? 250;
  const rateConfig = opts.maxScansPerWindow ?? { count: 20, windowMs: 5000 };
  const now = opts.now ?? (() => Date.now());

  const seen = new Set<string>();
  const recent: number[] = [];
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingAnchor: HTMLAnchorElement | null = null;
  let stopped = false;

  function withinRateLimit(): boolean {
    const cutoff = now() - rateConfig.windowMs;
    while (recent.length > 0 && recent[0]! < cutoff) recent.shift();
    if (recent.length >= rateConfig.count) return false;
    recent.push(now());
    return true;
  }

  async function scan(anchor: HTMLAnchorElement) {
    if (stopped) return;
    const href = anchor.href;
    if (seen.has(href)) return;
    if (opts.isTrusted(href)) return;
    if (!withinRateLimit()) return;
    seen.add(href);
    try {
      const result = await opts.analyze(href);
      if (stopped) return;
      if (result.verdict !== "safe") renderBadge(anchor, result);
    } catch (err) {
      console.warn("[aegis] hover scan failed", err);
    }
  }

  function clearPending() {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    pendingAnchor = null;
  }

  function onMouseOver(event: MouseEvent) {
    if (stopped) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (!anchor.href || !/^https?:/i.test(anchor.href)) return;
    pendingAnchor = anchor;
    if (pendingTimer !== null) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      const a = pendingAnchor;
      pendingTimer = null;
      pendingAnchor = null;
      if (a) void scan(a);
    }, debounceMs);
  }

  opts.root.addEventListener("mouseover", onMouseOver, { passive: true });

  return {
    stop() {
      stopped = true;
      opts.root.removeEventListener("mouseover", onMouseOver);
      clearPending();
    },
  };
}
