import { toast } from "sonner";

const CACHE_BUSTER_PARAM = "cache-reset";

const getReloadUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.set(CACHE_BUSTER_PARAM, Date.now().toString());
  return url.toString();
};

export async function resetCacheAndReload() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
    }

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key).catch(() => false)));
    }

    try {
      localStorage.removeItem("vite:cache");
      sessionStorage.removeItem("vite:cache");
    } catch {
      // ignore storage
    }

    toast.success("Кэш очищен. Перезагружаем…");
  } catch (error) {
    console.warn("cache reset failed", error);
    toast.warning("Не всё удалось очистить, пробуем обновить страницу…");
  }

  window.location.replace(getReloadUrl());
}
