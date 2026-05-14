import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/registerSW";
import { applyPalette, getStoredPalette } from "./lib/palettes";

try {
  applyPalette(getStoredPalette());

  registerServiceWorker();

  const root = document.getElementById("root");
  if (!root) throw new Error("Root element #root not found");

  window.__appStarted = true;
  createRoot(root).render(<App />);
} catch (error) {
  console.error("Fatal startup error", error);
  window.dispatchEvent(new CustomEvent("app-startup-error", { detail: error }));
}
