import { useCallback, useEffect, useState } from "react";
import { sendRequest } from "../../messaging/client";
import { newRequestId } from "../../shared/ids";
import type { UserSettings } from "../../storage/settings";

export interface UseSettings {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  update(patch: Partial<UserSettings>): Promise<void>;
  refresh(): Promise<void>;
}

/**
 * Hook that loads UserSettings from the background and exposes an `update()`
 * method that round-trips through the message bus. Settings come back fully
 * merged (the SettingsStore handles defaults), so callers can read fields
 * directly without null-checking layer flags.
 */
export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await sendRequest({ type: "GET_SETTINGS", requestId: newRequestId() });
      if (response.type === "ERROR") setError(response.message);
      else setSettings(response.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (patch: Partial<UserSettings>) => {
    setError(null);
    try {
      const response = await sendRequest({
        type: "UPDATE_SETTINGS",
        requestId: newRequestId(),
        patch,
      });
      if (response.type === "ERROR") setError(response.message);
      else setSettings(response.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { settings, loading, error, update, refresh };
}
