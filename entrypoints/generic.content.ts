import { defineContentScript } from "wxt/sandbox";
import { sendRequest } from "../src/messaging/client";
import { newRequestId } from "../src/shared/ids";
import { startHoverScanner } from "../src/ui/generic/hoverScanner";
import { makeIsTrusted } from "../src/ui/generic/trusted";
import type { AnalysisResult } from "../src/shared/verdict";

async function analyze(href: string): Promise<AnalysisResult> {
  const response = await sendRequest({
    type: "ANALYZE_URL",
    requestId: newRequestId(),
    url: href,
    context: { surface: "generic_page", userGesture: "hover" },
  });
  if (response.type === "ERROR") throw new Error(response.message);
  return response.result;
}

async function loadTrustedChecker(): Promise<(url: string) => boolean> {
  try {
    const response = await sendRequest({ type: "GET_SETTINGS", requestId: newRequestId() });
    if (response.type === "ERROR") return makeIsTrusted([]);
    return makeIsTrusted(response.settings.trustedDomains);
  } catch {
    return makeIsTrusted([]);
  }
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  excludeMatches: ["https://mail.google.com/*"],
  runAt: "document_idle",
  async main() {

    console.info("[aegis] generic content script loaded");

    const isTrusted = await loadTrustedChecker();
    const handle = startHoverScanner({ root: document, analyze, isTrusted });
    window.addEventListener("pagehide", () => handle.stop(), { once: true });
  },
});
