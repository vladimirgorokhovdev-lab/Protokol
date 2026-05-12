// PWA отключена. Новые Service Worker больше не регистрируем:
// повторная регистрация аварийного worker может зациклить перезагрузку
// во встроенных браузерах (например, Telegram). Оставляем только мягкую
// очистку уже существующих регистраций и кэшей.
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  let cleanupStarted = false;
  const cleanup = () => {
    if (cleanupStarted) return;
    cleanupStarted = true;

    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});

    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => {});
    }
  };

  window.addEventListener("load", cleanup, { once: true });
}
