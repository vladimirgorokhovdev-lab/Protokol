import { Capacitor } from "@capacitor/core";

/** Production web origin (punycode). Used for email links, invites, payment return. */
export const DEFAULT_PUBLIC_APP_URL = "https://xn--j1achabchr0f.xn--p1ai";

/** Custom URL scheme for opening the installed app (deep link). */
export const NATIVE_URL_SCHEME = "protokol";

/**
 * Public https origin for links that must work outside the WebView
 * (email confirmation, team invites, YooKassa return).
 */
export function getPublicAppUrl(): string {
  const fromEnv = String(import.meta.env.VITE_PUBLIC_APP_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    return DEFAULT_PUBLIC_APP_URL;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    if (
      origin.startsWith("http://localhost") ||
      origin.startsWith("https://localhost") ||
      origin.startsWith("capacitor:") ||
      origin.startsWith("ionic:")
    ) {
      return DEFAULT_PUBLIC_APP_URL;
    }
    return origin.replace(/\/+$/, "");
  }

  return DEFAULT_PUBLIC_APP_URL;
}

/** Absolute https URL on the public site, e.g. `/auth` → `https://…/auth`. */
export function publicAppHref(pathAndQuery: string): string {
  const path = pathAndQuery.startsWith("/")
    ? pathAndQuery
    : `/${pathAndQuery}`;
  return `${getPublicAppUrl()}${path}`;
}

/** Deep link into the native app, e.g. `protokol://pricing?payment=success`. */
export function nativeAppHref(pathAndQuery: string): string {
  const cleaned = pathAndQuery.replace(/^\//, "");
  return `${NATIVE_URL_SCHEME}://${cleaned}`;
}

/**
 * Parse Capacitor / custom-scheme open URL into an in-app router path.
 * `protokol://pricing?payment=success` → `/pricing?payment=success`
 */
export function pathFromAppOpenUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol === `${NATIVE_URL_SCHEME}:`) {
      const base =
        u.pathname && u.pathname !== "/"
          ? u.pathname
          : `/${u.hostname || ""}`;
      const normalized = base.startsWith("/") ? base : `/${base}`;
      return `${normalized}${u.search}${u.hash}` || "/";
    }
    // Universal / App Links (future): https://site/...
    if (u.protocol === "https:" || u.protocol === "http:") {
      return `${u.pathname}${u.search}${u.hash}` || "/";
    }
  } catch {
    return null;
  }
  return null;
}
