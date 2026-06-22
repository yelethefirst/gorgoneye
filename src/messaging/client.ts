import {
  isExtensionResponse,
  type ExtensionRequest,
  type RequestResponse,
} from "../shared/messages";

export async function sendRequest<T extends ExtensionRequest>(
  message: T,
): Promise<RequestResponse<T>> {
  const response = await chrome.runtime.sendMessage(message);
  if (!isExtensionResponse(response)) {
    throw new Error(
      `Unexpected response shape for ${message.type}: ${JSON.stringify(response)}`,
    );
  }
  return response as RequestResponse<T>;
}
