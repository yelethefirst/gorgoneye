import type { AnalysisResult, Verdict } from "../../shared/verdict";

const VERDICT_COLOR: Record<Verdict, string> = {
  safe: "#1f8a3a",
  suspicious: "#b25b00",
  phishing: "#b00020",
  unknown: "#555555",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  safe: "Safe",
  suspicious: "Suspicious",
  phishing: "Phishing",
  unknown: "Unknown",
};

export const BADGE_CLASS = "aegis-badge";
export const POPOVER_CLASS = "aegis-popover";

interface BadgeOptions {
  onOpen?(result: AnalysisResult): void;
}

/**
 * Renders a small inline status badge after the given anchor. Returns the badge
 * element so callers can update or remove it later. The badge is namespaced
 * with `aegis-` classes; no global styles are injected here. Styling is set
 * inline so a host page's CSS cannot break the verdict colors.
 */
export function renderBadge(
  anchor: HTMLAnchorElement,
  result: AnalysisResult,
  opts: BadgeOptions = {},
): HTMLButtonElement {
  let badge = anchor.parentElement?.querySelector<HTMLButtonElement>(
    `.${BADGE_CLASS}[data-aegis-anchor="${anchor.dataset.aegisAnchorId}"]`,
  );

  if (!badge) {
    badge = anchor.ownerDocument.createElement("button");
    badge.type = "button";
    badge.className = BADGE_CLASS;
    badge.dataset.aegisAnchorId = anchor.dataset.aegisAnchorId ?? "";
    Object.assign(badge.style, {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      marginLeft: "4px",
      padding: "1px 6px",
      borderRadius: "999px",
      border: "none",
      fontSize: "11px",
      fontWeight: "600",
      cursor: "pointer",
      lineHeight: "1.3",
      verticalAlign: "middle",
      color: "white",
    } satisfies Partial<CSSStyleDeclaration>);
    badge.setAttribute("role", "status");
    badge.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePopover(badge!, result, opts);
    });
    anchor.insertAdjacentElement("afterend", badge);
  }

  badge.style.background = VERDICT_COLOR[result.verdict];
  badge.setAttribute(
    "aria-label",
    `Aegis verdict for ${anchor.href}: ${VERDICT_LABEL[result.verdict]}`,
  );
  badge.title =
    `${VERDICT_LABEL[result.verdict]} (${Math.round(result.confidence * 100)}%)` +
    (result.firedSignals[0] ? ` · ${result.firedSignals[0].title}` : "");
  badge.textContent = VERDICT_LABEL[result.verdict];
  return badge;
}

function togglePopover(
  badge: HTMLButtonElement,
  result: AnalysisResult,
  opts: BadgeOptions,
): void {
  const doc = badge.ownerDocument;
  const existing = doc.querySelector<HTMLDivElement>(`.${POPOVER_CLASS}`);
  if (existing) {
    existing.remove();
    if (existing.dataset.aegisAnchorId === badge.dataset.aegisAnchorId) return;
  }

  const popover = doc.createElement("div");
  popover.className = POPOVER_CLASS;
  popover.dataset.aegisAnchorId = badge.dataset.aegisAnchorId ?? "";
  Object.assign(popover.style, {
    position: "absolute",
    zIndex: "2147483647",
    minWidth: "240px",
    maxWidth: "320px",
    padding: "8px 10px",
    background: "white",
    border: `1px solid ${VERDICT_COLOR[result.verdict]}`,
    borderRadius: "6px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "12px",
    color: "#111",
  } satisfies Partial<CSSStyleDeclaration>);

  const rect = badge.getBoundingClientRect();
  const win = doc.defaultView!;
  popover.style.left = `${rect.left + win.scrollX}px`;
  popover.style.top = `${rect.bottom + win.scrollY + 4}px`;

  const header = doc.createElement("div");
  header.style.cssText = `font-weight:600;color:${VERDICT_COLOR[result.verdict]};margin-bottom:4px;`;
  header.textContent = `${VERDICT_LABEL[result.verdict]} · ${Math.round(result.confidence * 100)}%`;
  popover.appendChild(header);

  const urlLine = doc.createElement("code");
  urlLine.style.cssText = "display:block;font-size:11px;color:#444;word-break:break-all;margin-bottom:4px;";
  urlLine.textContent = result.urlDisplay;
  popover.appendChild(urlLine);

  if (result.firedSignals.length > 0) {
    const list = doc.createElement("ul");
    list.style.cssText = "padding-left:14px;margin:4px 0;list-style:disc;";
    for (const signal of result.firedSignals.slice(0, 3)) {
      const li = doc.createElement("li");
      li.style.cssText = "margin-bottom:2px;color:#333;";
      li.textContent = signal.title;
      list.appendChild(li);
    }
    popover.appendChild(list);
  }

  const close = doc.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.style.cssText =
    "margin-top:6px;padding:2px 8px;font-size:11px;border:1px solid #ccc;background:white;border-radius:3px;cursor:pointer;";
  close.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    popover.remove();
  });
  popover.appendChild(close);

  doc.body.appendChild(popover);
  opts.onOpen?.(result);

  // Dismiss on outside click. Listener self-removes after firing.
  const onOutside = (event: MouseEvent) => {
    if (!popover.contains(event.target as Node) && event.target !== badge) {
      popover.remove();
      doc.removeEventListener("click", onOutside, true);
    }
  };
  // Defer attaching so the click that opened us doesn't dismiss it.
  setTimeout(() => doc.addEventListener("click", onOutside, true), 0);
}

export function removeBadge(anchor: HTMLAnchorElement): void {
  const id = anchor.dataset.aegisAnchorId;
  if (!id) return;
  anchor.parentElement
    ?.querySelector(`.${BADGE_CLASS}[data-aegis-anchor-id="${id}"]`)
    ?.remove();
}
