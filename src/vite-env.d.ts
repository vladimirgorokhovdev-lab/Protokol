/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_AUTH?: "lovable" | "supabase";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __hideSplash?: () => void;
  __recoverApp?: () => void;
  __copyStartupReport?: () => void;
  __appStarted?: boolean;
  __startupErrors?: string[];
}
