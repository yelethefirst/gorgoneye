import {
  isExtensionRequest,
  isExtensionResponse,
  makeErrorResponse,
  type ExtensionRequest,
  type ExtensionResponse,
} from "../shared/messages";

export type RequestHandler = (
  request: ExtensionRequest,
  sender: chrome.runtime.MessageSender,
) => Promise<ExtensionResponse>;

export function registerMessageRouter(handler: RequestHandler): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isExtensionResponse(message)) {
      return false;
    }

    if (!isExtensionRequest(message)) {
      sendResponse(
        makeErrorResponse(
          typeof (message as { requestId?: unknown })?.requestId === "string"
            ? (message as { requestId: string }).requestId
            : "unknown",
          "UNKNOWN_MESSAGE_TYPE",
          `Unknown message: ${JSON.stringify(message)}`,
        ),
      );
      return false;
    }

    handler(message, sender)
      .then(sendResponse)
      .catch((err: unknown) => {
        sendResponse(
          makeErrorResponse(
            message.requestId,
            "INTERNAL_ERROR",
            err instanceof Error ? err.message : String(err),
          ),
        );
      });
    return true; // keep message channel open for async response
  });
}
