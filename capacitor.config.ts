import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ru.protokol.app",
  appName: "ПротоколЪ",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // Allow opening Supabase / payment hosts without leaving the shell unexpectedly
    allowNavigation: [
      "xn--j1achabchr0f.xn--p1ai",
      "*.supabase.co",
      "*.yookassa.ru",
      "yoomoney.ru",
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#1B3A5C",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1B3A5C",
    },
    Keyboard: {
      resize: "body",
    },
  },
};

export default config;
