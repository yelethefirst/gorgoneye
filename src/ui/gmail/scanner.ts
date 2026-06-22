import type { AnalysisResult } from "../../shared/verdict";
import { renderBadge } from "../badges/badge";

const SCANNED_ATTR = "data-aegis-scanned";
const ANCHOR_ID_ATTR = "data-aegis-anchor-id";

/** Selector for anchors we want to scan inside an open Gmail message. */
const ANCHOR_SELECTOR = 'a[href^="http"]';

/** Container selector. Gmail's open-message region is inside `[role="main"]`. */
const MESSAGE_ROOT_SELECTOR = '[role="main"]';

export interface AnalyzeFn {
  (url: string, opts: { emailHeaderText?: string }): Promise<AnalysisResult>;
}

export interface ScannerOptions {
  root: Document;
  analyze: AnalyzeFn;
  /** Maximum links scanned in a single scan() call. Guards against pathological pages. */
  maxLinksPerScan?: number;
  /**
   * Hook that returns the raw email header text (RFC 5322) for the email
   * currently rendered, or `null` when none is available. The default
   * implementation looks for the `<pre>` block Gmail renders on its
   * "Show original" view (URL has `?view=om`). Override in tests.
   */
  extractEmailHeaderText?: (root: Document) => string | null;
}

export interface ScannerHandle {
  /** Force a full scan of the current DOM. */
  scan(): Promise<void>;
  /** Stop observing and disconnect. Idempotent. */
  stop(): void;
}

/**
 * Finds anchors under `[role="main"]` that have not been scanned yet.
 * Each anchor is tagged with `data-aegis-scanned="pending"` immediately to
 * dedupe concurrent scans, then upgraded once a verdict is available.
 *
 * Privacy invariant: this function only inspects `href` values. It never reads
 * surrounding text, sibling elements, or the message body.
 */
export function extractUnscannedAnchors(root: Document): HTMLAnchorElement[] {
  const message = root.querySelector(MESSAGE_ROOT_SELECTOR);
  if (!message) return [];
  const out: HTMLAnchorElement[] = [];
  const candidates = message.querySelectorAll<HTMLAnchorElement>(ANCHOR_SELECTOR);
  for (const a of candidates) {
    if (a.hasAttribute(SCANNED_ATTR)) continue;
    if (!a.href) continue;
    out.push(a);
  }
  return out;
}

/**
 * Best-effort extraction of the raw RFC 5322 header text from Gmail's
 * "Show original" view. That view is a separate URL (`?view=om`) that
 * renders the message source inside a `<pre>` block; before the body
 * starts there's a blank line. We slice up to that blank line so the
 * parser sees ONLY headers, not the body.
 *
 * In normal Gmail message view this returns `null` and the header layer
 * reports `not_available`, per AEG-7-3 acceptance criteria.
 */
export function extractGmailHeaderText(root: Document): string | null {
  // The "Show original" page is the only place Gmail exposes raw headers
  // to the content script's same-origin DOM. Bail early on regular views
  // so we never claim authentication data we don't have.
  const isShowOriginal =
    typeof root.location?.search === "string" && /[?&]view=om(\b|&)/.test(root.location.search);
  if (!isShowOriginal) return null;

  const pre = root.querySelector("pre");
  const raw = pre?.textContent ?? "";
  if (!raw.trim()) return null;

  // Find the first blank line; headers end there. If we don't find one
  // (truncated/malformed source) use the whole thing — the parser will
  // tolerate a body trailing the header block.
  const normalized = raw.replace(/\r\n/g, "\n");
  const blankIdx = normalized.indexOf("\n\n");
  return blankIdx >= 0 ? normalized.slice(0, blankIdx) : normalized;
}

let nextAnchorId = 1;
function assignAnchorId(anchor: HTMLAnchorElement): string {
  if (anchor.dataset.aegisAnchorId) return anchor.dataset.aegisAnchorId;
  const id = `aegis-${nextAnchorId++}`;
  anchor.dataset.aegisAnchorId = id;
  anchor.setAttribute(ANCHOR_ID_ATTR, id);
  return id;
}

/**
 * Starts a MutationObserver-backed scanner over the given document. Returns a
 * handle whose `stop()` disconnects observers and clears any pending work.
 *
 * The observer watches the entire document body because Gmail rerenders large
 * DOM subtrees on navigation; narrowing the target is brittle. The
 * `extractUnscannedAnchors` filter restricts work to the open-message region.
 */
export function startGmailScanner(opts: ScannerOptions): ScannerHandle {
  const max = opts.maxLinksPerScan ?? 50;
  const extractHeaders = opts.extractEmailHeaderText ?? extractGmailHeaderText;
  let stopped = false;
  let scheduled = false;

  async function scanOnce() {
    if (stopped) return;
    const anchors = extractUnscannedAnchors(opts.root).slice(0, max);
    if (anchors.length === 0) return;

    // Pull headers once per scan (not per anchor) — all links in an open
    // email share the same authentication context.
    const headerText = extractHeaders(opts.root) ?? undefined;

    // Mark all up-front so concurrent observers don't double-scan the same anchor.
    for (const a of anchors) {
      a.setAttribute(SCANNED_ATTR, "pending");
      assignAnchorId(a);
    }

    for (const anchor of anchors) {
      try {
        const result = await opts.analyze(anchor.href, headerText ? { emailHeaderText: headerText } : {});
        if (stopped) return;
        anchor.setAttribute(SCANNED_ATTR, "complete");
        renderBadge(anchor, result);
      } catch (err) {
        anchor.setAttribute(SCANNED_ATTR, "error");
        console.warn("[aegis] scan failed", err);
      }
    }
  }

  function schedule() {
    if (scheduled || stopped) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      void scanOnce();
    });
  }

  const observer = new MutationObserver(() => schedule());
  observer.observe(opts.root.body, { childList: true, subtree: true });

  // Initial pass for whatever is already in the DOM when we start.
  schedule();

  return {
    async scan() {
      await scanOnce();
    },
    stop() {
      stopped = true;
      observer.disconnect();
    },
  };
}
