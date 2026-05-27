const STORAGE_KEY = "protokol:history-last-seen-at";

export const HISTORY_UPDATED_EVENT = "protokol-history-updated";

export function getHistoryLastSeenAt(): string {
  if (typeof window === "undefined") return "1970-01-01T00:00:00Z";
  return localStorage.getItem(STORAGE_KEY) || "1970-01-01T00:00:00Z";
}

export function markHistorySeen(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT));
}

export function notifyHistoryUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT));
}
