import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/registerSW";
import { applyPalette, getStoredPalette } from "./lib/palettes";
import { installClipboardFriendlyUrls } from "./lib/friendlyUrl";
import { initNativeShell, isNativeApp } from "./lib/nativeShell";

try {
  applyPalette(getStoredPalette());
  installClipboardFriendlyUrls();

  // Service worker fights Capacitor's local asset loading — skip on native.
  if (!isNativeApp()) {
    registerServiceWorker();
  }

  void initNativeShell();

  const root = document.getElementById("root");
  if (!root) throw new Error("Root element #root not found");

  window.__appStarted = true;
  createRoot(root).render(<App />);
} catch (error) {
  console.error("Fatal startup error", error);
  window.dispatchEvent(new CustomEvent("app-startup-error", { detail: error }));
}
