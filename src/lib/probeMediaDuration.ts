/** Длительность медиа в секундах (0 если не удалось прочитать метаданные). */
export function probeMediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    const el = document.createElement(
      isVideo ? "video" : "audio",
    ) as HTMLMediaElement;
    const cleanup = () => URL.revokeObjectURL(url);
    const timeout = setTimeout(() => {
      cleanup();
      resolve(0);
    }, 8000);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      clearTimeout(timeout);
      const d = isFinite(el.duration) ? el.duration : 0;
      cleanup();
      resolve(d);
    };
    el.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve(0);
    };
    el.src = url;
  });
}
