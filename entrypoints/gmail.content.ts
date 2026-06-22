import { defineContentScript } from "wxt/sandbox";
import { sendRequest } from "../src/messaging/client";
import { newRequestId } from "../src/shared/ids";
import { startGmailScanner } from "../src/ui/gmail/scanner";
import type { AnalysisResult } from "../src/shared/verdict";

async function analyze(
  href: string,
  opts: { emailHeaderText?: string },
): Promise<AnalysisResult> {
  const response = await sendRequest({
    type: "ANALYZE_URL",
    requestId: newRequestId(),
    url: href,
    context: { surface: "gmail", userGesture: "email_open" },
    ...(opts.emailHeaderText ? { emailHeaderText: opts.emailHeaderText } : {}),
  });
  if (response.type === "ERROR") throw new Error(response.message);
  return response.result;
}

export default defineContentScript({
  matches: ["https://mail.google.com/*"],
  runAt: "document_idle",
  main() {

    console.info("[aegis] gmail content script loaded");

    const handle = startGmailScanner({ root: document, analyze });

    // Stop the scanner when the page unloads. Service-worker restarts will
    // re-inject the content script and start a fresh observer.
    window.addEventListener("pagehide", () => handle.stop(), { once: true });
  },
});
