import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { pathFromAppOpenUrl } from "@/lib/appUrl";

type OpenHandler = (path: string) => void;

let openHandler: OpenHandler | null = null;

/** Register React Router navigation for deep links (call once from App). */
export function setNativeOpenHandler(handler: OpenHandler | null): void {
  openHandler = handler;
}

/** Native shell bootstrap — no-op in plain browser. */
export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#1B3A5C" });
  } catch (e) {
    console.warn("StatusBar init failed", e);
  }

  CapApp.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      void CapApp.exitApp();
    }
  });

  CapApp.addListener("appUrlOpen", ({ url }) => {
    const path = pathFromAppOpenUrl(url);
    if (path && openHandler) {
      openHandler(path);
    } else if (path) {
      window.location.hash = path;
    }
  });
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Open payment / external pages outside the WebView.
 * Keeps Apple/Google happier: checkout is not an in-app storefront WebView.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
    return;
  }
  window.location.assign(url);
}

/** Close in-app browser (e.g. after user returns from payment). */
export async function closeExternalBrowser(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Browser.close();
  } catch {
    // already closed
  }
}
