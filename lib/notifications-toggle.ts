"use client";

const STORAGE_KEY = "inbound_popup_notifications_enabled";
const EVENT_NAME = "inbound_popup_notifications_toggle";

/**
 * Gets the current preference for incoming message popup notifications.
 * Defaults to true (ON).
 */
export function getPopupNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === "true" : true;
  } catch (e) {
    console.error("Failed to read popup notifications preference:", e);
    return true;
  }
}

/**
 * Updates the preference for incoming message popup notifications.
 * Persists to localStorage and dispatches a custom event for instant cross-component synchronization.
 */
export function setPopupNotificationsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { enabled } })
    );
  } catch (e) {
    console.error("Failed to save popup notifications preference:", e);
  }
}

/**
 * Subscribes to changes in the popup notifications preference.
 */
export function subscribePopupNotificationsToggle(
  callback: (enabled: boolean) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handleCustomEvent = (e: Event) => {
    const customEvent = e as CustomEvent<{ enabled: boolean }>;
    callback(customEvent.detail.enabled);
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      callback(e.newValue !== "false");
    }
  };

  window.addEventListener(EVENT_NAME, handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(EVENT_NAME, handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}
