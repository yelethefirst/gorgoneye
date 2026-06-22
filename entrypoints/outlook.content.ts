import { defineContentScript } from "wxt/sandbox";
import { sendRequest } from "../src/messaging/client";
import { newRequestId } from "../src/shared/ids";
import { startOutlookScanner } from "../src/ui/outlook/scanner";
import type { AnalysisResult } from "../src/shared/verdict";

async function analyze(href: string): Promise<AnalysisResult> {
  const response = await sendRequest({
    type: "ANALYZE_URL",
    requestId: newRequestId(),
    url: href,
    context: { surface: "outlook", userGesture: "email_open" },
  });
  if (response.type === "ERROR") throw new Error(response.message);
  return response.result;
}

export default defineContentScript({
  matches: [
    "https://outlook.live.com/*",
    "https://outlook.office.com/*",
    "https://outlook.office365.com/*",
  ],
  runAt: "document_idle",
  main() {
    console.info("[aegis] outlook content script loaded");
    const handle = startOutlookScanner({ root: document, analyze });
    window.addEventListener("pagehide", () => handle.stop(), { once: true });
  },
});
