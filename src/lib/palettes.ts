export type PaletteId = "peacock" | "blue" | "purple" | "green" | "burgundy";

interface PaletteThemeTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

interface PaletteExtras {
  gold: string;
  goldLight: string;
  goldDark: string;
  navy: string;
  navyLight: string;
  navyDark: string;
}

export interface Palette {
  id: PaletteId;
  name: string;
  description: string;
  swatch: { primary: string; accent: string };
  light: PaletteThemeTokens;
  dark: PaletteThemeTokens;
  extras: PaletteExtras;
}

export const PALETTES: Palette[] = [
  {
    id: "peacock",
    name: "Процессуальный бирюзовый",
    description: "Холодный бирюзовый и тёплая бронза",
    swatch: { primary: "186 86% 24%", accent: "36 68% 62%" },
    light: {
      background: "184 46% 91%",
      foreground: "188 72% 10%",
      card: "184 52% 97%",
      cardForeground: "188 72% 10%",
      popover: "184 52% 97%",
      popoverForeground: "188 72% 10%",
      primary: "186 86% 24%",
      primaryForeground: "42 40% 92%",
      secondary: "184 36% 85%",
      secondaryForeground: "188 66% 13%",
      muted: "184 32% 87%",
      mutedForeground: "188 28% 34%",
      accent: "36 68% 62%",
      accentForeground: "188 75% 10%",
      border: "184 34% 74%",
      input: "184 34% 74%",
      ring: "36 68% 55%",
      sidebarBackground: "184 44% 93%",
      sidebarForeground: "188 58% 17%",
      sidebarPrimary: "186 86% 24%",
      sidebarPrimaryForeground: "42 40% 92%",
      sidebarAccent: "184 36% 85%",
      sidebarAccentForeground: "188 66% 13%",
      sidebarBorder: "184 34% 76%",
      sidebarRing: "36 68% 55%",
    },
    dark: {
      background: "188 64% 7%",
      foreground: "42 35% 92%",
      card: "188 58% 11%",
      cardForeground: "42 35% 92%",
      popover: "188 58% 11%",
      popoverForeground: "42 35% 92%",
      primary: "186 86% 24%",
      primaryForeground: "42 40% 92%",
      secondary: "188 46% 17%",
      secondaryForeground: "42 35% 92%",
      muted: "188 42% 15%",
      mutedForeground: "42 20% 70%",
      accent: "36 68% 62%",
      accentForeground: "188 75% 10%",
      border: "188 42% 19%",
      input: "188 42% 19%",
      ring: "36 68% 55%",
      sidebarBackground: "188 64% 8%",
      sidebarForeground: "42 30% 88%",
      sidebarPrimary: "186 86% 24%",
      sidebarPrimaryForeground: "42 40% 92%",
      sidebarAccent: "188 42% 15%",
      sidebarAccentForeground: "42 35% 92%",
      sidebarBorder: "188 42% 19%",
      sidebarRing: "36 68% 55%",
    },
    extras: {
      gold: "36 70% 58%",
      goldLight: "38 64% 78%",
      goldDark: "32 74% 42%",
      navy: "186 86% 24%",
      navyLight: "184 68% 38%",
      navyDark: "188 88% 13%",
    },
  },
  {
    id: "blue",
    name: "Судейский синий",
    description: "Глубокий королевский синий и золото",
    swatch: { primary: "220 70% 28%", accent: "45 70% 55%" },
    light: {
      background: "220 55% 92%",
      foreground: "220 60% 13%",
      card: "220 55% 97%",
      cardForeground: "220 60% 13%",
      popover: "220 55% 97%",
      popoverForeground: "220 60% 13%",
      primary: "220 70% 28%",
      primaryForeground: "45 40% 94%",
      secondary: "220 38% 86%",
      secondaryForeground: "220 60% 15%",
      muted: "220 32% 88%",
      mutedForeground: "220 28% 36%",
      accent: "45 70% 55%",
      accentForeground: "220 70% 12%",
      border: "220 32% 76%",
      input: "220 32% 76%",
      ring: "45 70% 50%",
      sidebarBackground: "220 50% 94%",
      sidebarForeground: "220 50% 20%",
      sidebarPrimary: "220 70% 28%",
      sidebarPrimaryForeground: "45 40% 94%",
      sidebarAccent: "220 38% 86%",
      sidebarAccentForeground: "220 60% 15%",
      sidebarBorder: "220 32% 78%",
      sidebarRing: "45 70% 50%",
    },
    dark: {
      background: "220 45% 8%",
      foreground: "45 28% 92%",
      card: "220 40% 12%",
      cardForeground: "45 28% 92%",
      popover: "220 40% 12%",
      popoverForeground: "45 28% 92%",
      primary: "220 70% 28%",
      primaryForeground: "45 40% 94%",
      secondary: "220 32% 18%",
      secondaryForeground: "45 28% 92%",
      muted: "220 28% 16%",
      mutedForeground: "220 14% 72%",
      accent: "45 70% 55%",
      accentForeground: "220 70% 12%",
      border: "220 24% 22%",
      input: "220 24% 22%",
      ring: "45 70% 50%",
      sidebarBackground: "220 44% 9%",
      sidebarForeground: "45 24% 88%",
      sidebarPrimary: "220 70% 28%",
      sidebarPrimaryForeground: "45 40% 94%",
      sidebarAccent: "220 28% 16%",
      sidebarAccentForeground: "45 28% 92%",
      sidebarBorder: "220 24% 22%",
      sidebarRing: "45 70% 50%",
    },
    extras: {
      gold: "45 72% 55%",
      goldLight: "45 65% 75%",
      goldDark: "40 75% 40%",
      navy: "220 70% 28%",
      navyLight: "220 55% 42%",
      navyDark: "220 75% 18%",
    },
  },
  {
    id: "purple",
    name: "Безапелляционный фиолетовый",
    description: "Глубокий пурпур и тёплое золото",
    swatch: { primary: "270 55% 30%", accent: "42 65% 58%" },
    light: {
      background: "278 40% 92%",
      foreground: "270 50% 15%",
      card: "278 42% 97%",
      cardForeground: "270 50% 15%",
      popover: "278 42% 97%",
      popoverForeground: "270 50% 15%",
      primary: "270 55% 30%",
      primaryForeground: "42 40% 94%",
      secondary: "275 32% 86%",
      secondaryForeground: "270 48% 18%",
      muted: "278 28% 88%",
      mutedForeground: "270 26% 38%",
      accent: "42 65% 58%",
      accentForeground: "270 60% 12%",
      border: "275 28% 76%",
      input: "275 28% 76%",
      ring: "42 65% 52%",
      sidebarBackground: "278 38% 94%",
      sidebarForeground: "270 42% 22%",
      sidebarPrimary: "270 55% 30%",
      sidebarPrimaryForeground: "42 40% 94%",
      sidebarAccent: "278 30% 86%",
      sidebarAccentForeground: "270 48% 18%",
      sidebarBorder: "275 28% 78%",
      sidebarRing: "42 65% 52%",
    },
    dark: {
      background: "270 32% 8%",
      foreground: "42 28% 92%",
      card: "270 28% 12%",
      cardForeground: "42 28% 92%",
      popover: "270 28% 12%",
      popoverForeground: "42 28% 92%",
      primary: "270 55% 30%",
      primaryForeground: "42 40% 94%",
      secondary: "270 22% 18%",
      secondaryForeground: "42 28% 92%",
      muted: "270 20% 16%",
      mutedForeground: "270 12% 72%",
      accent: "42 65% 58%",
      accentForeground: "270 60% 12%",
      border: "270 18% 22%",
      input: "270 18% 22%",
      ring: "42 65% 52%",
      sidebarBackground: "270 30% 9%",
      sidebarForeground: "42 24% 88%",
      sidebarPrimary: "270 55% 30%",
      sidebarPrimaryForeground: "42 40% 94%",
      sidebarAccent: "270 20% 16%",
      sidebarAccentForeground: "42 28% 92%",
      sidebarBorder: "270 18% 22%",
      sidebarRing: "42 65% 52%",
    },
    extras: {
      gold: "42 68% 56%",
      goldLight: "42 60% 76%",
      goldDark: "38 72% 42%",
      navy: "270 55% 30%",
      navyLight: "270 45% 45%",
      navyDark: "270 60% 18%",
    },
  },
  {
    id: "green",
    name: "Адвокатский зелёный",
    description: "Тёплый лесной зелёный и патинированная бронза",
    swatch: { primary: "132 48% 20%", accent: "46 58% 52%" },
    light: {
      background: "112 34% 91%",
      foreground: "132 52% 11%",
      card: "112 36% 97%",
      cardForeground: "132 52% 11%",
      popover: "112 36% 97%",
      popoverForeground: "132 52% 11%",
      primary: "132 48% 20%",
      primaryForeground: "40 40% 94%",
      secondary: "118 26% 85%",
      secondaryForeground: "132 48% 13%",
      muted: "116 24% 87%",
      mutedForeground: "132 24% 34%",
      accent: "46 58% 52%",
      accentForeground: "132 55% 9%",
      border: "118 24% 74%",
      input: "118 24% 74%",
      ring: "46 58% 46%",
      sidebarBackground: "112 32% 93%",
      sidebarForeground: "132 42% 18%",
      sidebarPrimary: "132 48% 20%",
      sidebarPrimaryForeground: "40 40% 94%",
      sidebarAccent: "118 26% 85%",
      sidebarAccentForeground: "132 48% 13%",
      sidebarBorder: "118 24% 76%",
      sidebarRing: "46 58% 46%",
    },
    dark: {
      background: "132 30% 7%",
      foreground: "40 28% 92%",
      card: "132 26% 11%",
      cardForeground: "40 28% 92%",
      popover: "132 26% 11%",
      popoverForeground: "40 28% 92%",
      primary: "132 48% 20%",
      primaryForeground: "40 40% 94%",
      secondary: "132 20% 17%",
      secondaryForeground: "40 28% 92%",
      muted: "132 18% 15%",
      mutedForeground: "132 12% 72%",
      accent: "46 58% 52%",
      accentForeground: "132 55% 9%",
      border: "132 16% 21%",
      input: "132 16% 21%",
      ring: "46 58% 46%",
      sidebarBackground: "132 30% 8%",
      sidebarForeground: "40 24% 88%",
      sidebarPrimary: "132 48% 20%",
      sidebarPrimaryForeground: "40 40% 94%",
      sidebarAccent: "132 18% 15%",
      sidebarAccentForeground: "40 28% 92%",
      sidebarBorder: "132 16% 21%",
      sidebarRing: "46 58% 46%",
    },
    extras: {
      gold: "46 60% 50%",
      goldLight: "48 54% 72%",
      goldDark: "42 66% 36%",
      navy: "132 48% 20%",
      navyLight: "132 38% 34%",
      navyDark: "132 54% 12%",
    },
  },
  {
    id: "burgundy",
    name: "Гражданский бордовый",
    description: "Насыщенное вино и шампанское золото",
    swatch: { primary: "350 55% 28%", accent: "42 60% 60%" },
    light: {
      background: "352 42% 92%",
      foreground: "350 55% 14%",
      card: "352 45% 97%",
      cardForeground: "350 55% 14%",
      popover: "352 45% 97%",
      popoverForeground: "350 55% 14%",
      primary: "350 55% 28%",
      primaryForeground: "42 40% 94%",
      secondary: "352 32% 86%",
      secondaryForeground: "350 50% 16%",
      muted: "352 28% 88%",
      mutedForeground: "350 26% 36%",
      accent: "42 60% 60%",
      accentForeground: "350 60% 12%",
      border: "352 28% 76%",
      input: "352 28% 76%",
      ring: "42 60% 52%",
      sidebarBackground: "352 40% 94%",
      sidebarForeground: "350 42% 20%",
      sidebarPrimary: "350 55% 28%",
      sidebarPrimaryForeground: "42 40% 94%",
      sidebarAccent: "352 30% 86%",
      sidebarAccentForeground: "350 50% 16%",
      sidebarBorder: "352 28% 78%",
      sidebarRing: "42 60% 52%",
    },
    dark: {
      background: "350 28% 8%",
      foreground: "42 28% 92%",
      card: "350 24% 12%",
      cardForeground: "42 28% 92%",
      popover: "350 24% 12%",
      popoverForeground: "42 28% 92%",
      primary: "350 55% 28%",
      primaryForeground: "42 40% 94%",
      secondary: "350 18% 18%",
      secondaryForeground: "42 28% 92%",
      muted: "350 16% 16%",
      mutedForeground: "350 10% 72%",
      accent: "42 60% 60%",
      accentForeground: "350 60% 12%",
      border: "350 14% 22%",
      input: "350 14% 22%",
      ring: "42 60% 52%",
      sidebarBackground: "350 26% 9%",
      sidebarForeground: "42 24% 88%",
      sidebarPrimary: "350 55% 28%",
      sidebarPrimaryForeground: "42 40% 94%",
      sidebarAccent: "350 16% 16%",
      sidebarAccentForeground: "42 28% 92%",
      sidebarBorder: "350 14% 22%",
      sidebarRing: "42 60% 52%",
    },
    extras: {
      gold: "42 65% 56%",
      goldLight: "42 58% 76%",
      goldDark: "38 70% 42%",
      navy: "350 55% 28%",
      navyLight: "350 45% 42%",
      navyDark: "350 60% 18%",
    },
  },
];

const STORAGE_KEY = "app-palette";
export const DEFAULT_PALETTE: PaletteId = "peacock";

export function getStoredPalette(): PaletteId {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  let v: string | null = null;
  try {
    v = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_PALETTE;
  }
  if (v && PALETTES.some((p) => p.id === v)) return v as PaletteId;
  return DEFAULT_PALETTE;
}

export function storePalette(id: PaletteId) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* Storage can be blocked in strict Firefox/privacy modes. */
  }
}

function applyThemeVariant(prefix: "light" | "dark", theme: PaletteThemeTokens) {
  const root = document.documentElement;

  root.style.setProperty(`--background-${prefix}`, theme.background);
  root.style.setProperty(`--foreground-${prefix}`, theme.foreground);
  root.style.setProperty(`--card-${prefix}`, theme.card);
  root.style.setProperty(`--card-foreground-${prefix}`, theme.cardForeground);
  root.style.setProperty(`--popover-${prefix}`, theme.popover);
  root.style.setProperty(`--popover-foreground-${prefix}`, theme.popoverForeground);
  root.style.setProperty(`--primary-${prefix}`, theme.primary);
  root.style.setProperty(`--primary-foreground-${prefix}`, theme.primaryForeground);
  root.style.setProperty(`--secondary-${prefix}`, theme.secondary);
  root.style.setProperty(`--secondary-foreground-${prefix}`, theme.secondaryForeground);
  root.style.setProperty(`--muted-${prefix}`, theme.muted);
  root.style.setProperty(`--muted-foreground-${prefix}`, theme.mutedForeground);
  root.style.setProperty(`--accent-${prefix}`, theme.accent);
  root.style.setProperty(`--accent-foreground-${prefix}`, theme.accentForeground);
  root.style.setProperty(`--border-${prefix}`, theme.border);
  root.style.setProperty(`--input-${prefix}`, theme.input);
  root.style.setProperty(`--ring-${prefix}`, theme.ring);
  root.style.setProperty(`--sidebar-background-${prefix}`, theme.sidebarBackground);
  root.style.setProperty(`--sidebar-foreground-${prefix}`, theme.sidebarForeground);
  root.style.setProperty(`--sidebar-primary-${prefix}`, theme.sidebarPrimary);
  root.style.setProperty(`--sidebar-primary-foreground-${prefix}`, theme.sidebarPrimaryForeground);
  root.style.setProperty(`--sidebar-accent-${prefix}`, theme.sidebarAccent);
  root.style.setProperty(`--sidebar-accent-foreground-${prefix}`, theme.sidebarAccentForeground);
  root.style.setProperty(`--sidebar-border-${prefix}`, theme.sidebarBorder);
  root.style.setProperty(`--sidebar-ring-${prefix}`, theme.sidebarRing);
}

let fadeOverlay: HTMLDivElement | null = null;
let fadeTimeout: number | null = null;

function triggerPaletteFade() {
  if (typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  if (!fadeOverlay) {
    fadeOverlay = document.createElement("div");
    fadeOverlay.setAttribute("aria-hidden", "true");
    fadeOverlay.style.cssText =
      "position:fixed;inset:0;background:hsl(var(--background));opacity:0;pointer-events:none;z-index:9999;transition:opacity 180ms ease-out;will-change:opacity;";
    document.body.appendChild(fadeOverlay);
  }

  if (fadeTimeout) window.clearTimeout(fadeTimeout);
  fadeOverlay.style.opacity = "0.35";
  fadeTimeout = window.setTimeout(() => {
    if (fadeOverlay) fadeOverlay.style.opacity = "0";
  }, 60);
}

export function applyPalette(id: PaletteId) {
  const palette = PALETTES.find((p) => p.id === id) ?? PALETTES[0];
  const root = document.documentElement;

  triggerPaletteFade();

  applyThemeVariant("light", palette.light);
  applyThemeVariant("dark", palette.dark);

  root.style.setProperty("--gold", palette.extras.gold);
  root.style.setProperty("--gold-light", palette.extras.goldLight);
  root.style.setProperty("--gold-dark", palette.extras.goldDark);
  root.style.setProperty("--navy", palette.extras.navy);
  root.style.setProperty("--navy-light", palette.extras.navyLight);
  root.style.setProperty("--navy-dark", palette.extras.navyDark);
}
