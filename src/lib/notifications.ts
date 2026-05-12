const STORAGE_KEY = "protokol-notifications-enabled";

export function getNotificationsEnabled(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export function setNotificationsEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (!getNotificationsEnabled()) return false;

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  return result === "granted";
}

export function canNotify(): boolean {
  return (
    "Notification" in window &&
    Notification.permission === "granted" &&
    getNotificationsEnabled()
  );
}

export function showTranscriptionDoneNotification(
  fileName: string,
  segmentCount: number,
) {
  if (!canNotify()) return;
  if (document.visibilityState === "visible") return;

  const notification = new Notification("ПротоколЪ — Расшифровка готова", {
    body: `${fileName}: ${segmentCount} фрагментов`,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `transcription-${fileName}`,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}
