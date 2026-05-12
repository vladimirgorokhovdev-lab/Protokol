/// <reference types="vite/client" />

interface Window {
  __hideSplash?: () => void;
  __recoverApp?: () => void;
  __copyStartupReport?: () => void;
  __appStarted?: boolean;
  __startupErrors?: string[];
}
