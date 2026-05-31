import { SITE_ORIGIN, siteUrl } from "@/lib/siteUrl";

const PUNYCODE_ORIGIN_RE =
  /https?:\/\/(?:www\.)?xn--j1achabchr0f\.xn--p1ai/gi;
const PUNYCODE_HOST_RE = /(?:www\.)?xn--j1achabchr0f\.xn--p1ai/gi;

/** Заменяет punycode-домен на кириллический в строке URL. */
export function toFriendlyUrl(text: string): string {
  return text
    .replace(PUNYCODE_ORIGIN_RE, SITE_ORIGIN)
    .replace(PUNYCODE_HOST_RE, "протоколъ.рф");
}

/** Текущая страница с кириллическим доменом (для копирования). */
export function currentFriendlyUrl(): string {
  const { pathname, search, hash } = window.location;
  return siteUrl(`${pathname}${search}${hash}`);
}

export async function copyFriendlyUrl(url?: string): Promise<boolean> {
  const value = url ? toFriendlyUrl(url) : currentFriendlyUrl();
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** При копировании текста со страницы подменяет punycode на протоколъ.рф. */
export function installClipboardFriendlyUrls(): void {
  document.addEventListener("copy", (e) => {
    const sel = window.getSelection()?.toString() ?? "";
    if (!sel.includes("xn--")) return;
    const friendly = toFriendlyUrl(sel);
    if (friendly === sel) return;
    e.clipboardData?.setData("text/plain", friendly);
    e.preventDefault();
  });
}
