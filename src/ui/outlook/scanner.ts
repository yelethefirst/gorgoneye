import type { AnalysisResult } from "../../shared/verdict";
import { renderBadge } from "../badges/badge";

const SCANNED_ATTR = "data-aegis-scanned";
const ANCHOR_ID_ATTR = "data-aegis-anchor-id";
const ANCHOR_SELECTOR = 'a[href^="http"]';

/**
 * Outlook Web's open-message region is rendered into a region with
 * `role="main"` (same as Gmail). For older OWA shells we also accept the
 * legacy `[role="region"][aria-label*="Reading"]` reading pane.
 */
const MESSAGE_ROOT_SELECTORS = [
  '[role="main"]',
  '[role="region"][aria-label*="Reading" i]',
  '[role="document"]',
];

export interface AnalyzeFn {
  (url: string): Promise<AnalysisResult>;
}

export interface OutlookScannerOptions {
  root: Document;
  analyze: AnalyzeFn;
  maxLinksPerScan?: number;
}

export interface OutlookScannerHandle {
  scan(): Promise<void>;
  stop(): void;
}

function findMessageRoot(root: Document): Element | null {
  for (const selector of MESSAGE_ROOT_SELECTORS) {
    const found = root.querySelector(selector);
    if (found) return found;
  }
  return null;
}

export function extractUnscannedAnchors(root: Document): HTMLAnchorElement[] {
  const message = findMessageRoot(root);
  if (!message) return [];
  const out: HTMLAnchorElement[] = [];
  for (const a of message.querySelectorAll<HTMLAnchorElement>(ANCHOR_SELECTOR)) {
    if (a.hasAttribute(SCANNED_ATTR)) continue;
    if (!a.href) continue;
    out.push(a);
  }
  return out;
}

let nextAnchorId = 1;
function assignAnchorId(anchor: HTMLAnchorElement): string {
  if (anchor.dataset.aegisAnchorId) return anchor.dataset.aegisAnchorId;
  const id = `aegis-outlook-${nextAnchorId++}`;
  anchor.dataset.aegisAnchorId = id;
  anchor.setAttribute(ANCHOR_ID_ATTR, id);
  return id;
}

/**
 * Starts a MutationObserver-backed scanner over an Outlook Web document.
 *
 * Privacy invariant (same as the Gmail scanner): only `href` values are read;
 * the surrounding message body is never inspected.
 */
export function startOutlookScanner(opts: OutlookScannerOptions): OutlookScannerHandle {
  const max = opts.maxLinksPerScan ?? 50;
  let stopped = false;
  let scheduled = false;

  async function scanOnce() {
    if (stopped) return;
    const anchors = extractUnscannedAnchors(opts.root).slice(0, max);
    if (anchors.length === 0) return;
    for (const a of anchors) {
      a.setAttribute(SCANNED_ATTR, "pending");
      assignAnchorId(a);
    }
    for (const anchor of anchors) {
      try {
        const result = await opts.analyze(anchor.href);
        if (stopped) return;
        anchor.setAttribute(SCANNED_ATTR, "complete");
        renderBadge(anchor, result);
      } catch (err) {
        anchor.setAttribute(SCANNED_ATTR, "error");
        console.warn("[aegis/outlook] scan failed", err);
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
