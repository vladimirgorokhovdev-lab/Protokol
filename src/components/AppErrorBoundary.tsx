import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Trash2, ClipboardCopy, Check } from "lucide-react";

declare const __BUILD_VERSION__: string;

type Props = {
  children: ReactNode;
};

type ApiStatus = "checking" | "ok" | "fail" | "unknown";

type Diagnostics = {
  buildVersion: string;
  userAgent: string;
  url: string;
  online: boolean;
  language: string;
  viewport: string;
  serviceWorker: string;
  apiStatus: ApiStatus;
  apiDetail: string;
  consoleErrors: string[];
};

type State = {
  error: Error | null;
  diagnostics: Diagnostics;
  copied: boolean;
};

const MAX_CONSOLE_ERRORS = 20;
const consoleErrorBuffer: string[] = [];

if (typeof window !== "undefined" && !(window as any).__consoleErrorPatched) {
  (window as any).__consoleErrorPatched = true;
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const msg = args
        .map((a) => {
          if (a instanceof Error) return a.stack || a.message;
          if (typeof a === "string") return a;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(" ");
      consoleErrorBuffer.push(`[${new Date().toISOString()}] ${msg}`);
      if (consoleErrorBuffer.length > MAX_CONSOLE_ERRORS) {
        consoleErrorBuffer.splice(0, consoleErrorBuffer.length - MAX_CONSOLE_ERRORS);
      }
    } catch {
      /* ignore */
    }
    origError(...args);
  };
  window.addEventListener("error", (e) => {
    consoleErrorBuffer.push(
      `[${new Date().toISOString()}] window.error: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`,
    );
  });
  window.addEventListener("unhandledrejection", (e) => {
    consoleErrorBuffer.push(
      `[${new Date().toISOString()}] unhandledrejection: ${String((e as any).reason?.stack || (e as any).reason || "")}`,
    );
  });
}

const resetBrowserState = async () => {
  try { localStorage.clear(); } catch { /* ignore */ }
  try { sessionStorage.clear(); } catch { /* ignore */ }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch { /* ignore */ }
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch { /* ignore */ }

  const url = new URL(window.location.href);
  url.searchParams.set("app-reset", Date.now().toString());
  window.location.replace(url.toString());
};

const getBuildVersion = (): string => {
  try {
    return typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "dev";
  } catch {
    return "unknown";
  }
};

const collectServiceWorkerInfo = async (): Promise<string> => {
  if (!("serviceWorker" in navigator)) return "не поддерживается";
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) return "не зарегистрирован";
    return regs
      .map((r) => {
        const state = r.active?.state || r.installing?.state || r.waiting?.state || "—";
        return `${r.scope} (${state})`;
      })
      .join("; ");
  } catch (e) {
    return `ошибка: ${(e as Error).message}`;
  }
};

const checkApi = async (): Promise<{ status: ApiStatus; detail: string }> => {
  const supaUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  if (!supaUrl) return { status: "unknown", detail: "URL не настроен" };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${supaUrl}/auth/v1/health`, {
      method: "GET",
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    return {
      status: res.ok ? "ok" : "fail",
      detail: `HTTP ${res.status}`,
    };
  } catch (e) {
    return { status: "fail", detail: (e as Error).message };
  }
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    diagnostics: {
      buildVersion: getBuildVersion(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      url: typeof window !== "undefined" ? window.location.href : "",
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
      language: typeof navigator !== "undefined" ? navigator.language : "",
      viewport:
        typeof window !== "undefined"
          ? `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`
          : "",
      serviceWorker: "проверка…",
      apiStatus: "checking",
      apiDetail: "",
      consoleErrors: [...consoleErrorBuffer],
    },
    copied: false,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App render failed", error, info);
    this.runDiagnostics();
  }

  componentDidMount() {
    window.__hideSplash?.();
  }

  private async runDiagnostics() {
    const [sw, api] = await Promise.all([collectServiceWorkerInfo(), checkApi()]);
    this.setState((prev) => ({
      diagnostics: {
        ...prev.diagnostics,
        serviceWorker: sw,
        apiStatus: api.status,
        apiDetail: api.detail,
        consoleErrors: [...consoleErrorBuffer],
      },
    }));
  }

  private buildReport(): string {
    const d = this.state.diagnostics;
    const err = this.state.error;
    const lines = [
      "=== LexScribe — Отчёт о сбое ===",
      `Время: ${new Date().toISOString()}`,
      `Сборка: ${d.buildVersion}`,
      `URL: ${d.url}`,
      `Online: ${d.online}`,
      `Язык: ${d.language}`,
      `Окно: ${d.viewport}`,
      `User-Agent: ${d.userAgent}`,
      `Service Worker: ${d.serviceWorker}`,
      `API статус: ${d.apiStatus} (${d.apiDetail})`,
      "",
      "--- Ошибка ---",
      err?.message || "—",
      err?.stack || "",
      "",
      "--- Консоль (последние ошибки) ---",
      ...(d.consoleErrors.length ? d.consoleErrors : ["—"]),
    ];
    return lines.join("\n");
  }

  private handleCopy = async () => {
    const report = this.buildReport();
    try {
      await navigator.clipboard.writeText(report);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = report;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (!this.state.error) return this.props.children;
    const d = this.state.diagnostics;

    const apiBadge =
      d.apiStatus === "ok"
        ? "bg-emerald-500/10 text-emerald-600"
        : d.apiStatus === "fail"
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground";
    const apiLabel =
      d.apiStatus === "ok"
        ? "OK"
        : d.apiStatus === "fail"
          ? "Недоступно"
          : d.apiStatus === "checking"
            ? "Проверка…"
            : "—";

    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
        <section className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-playfair text-2xl font-semibold">Приложение не загрузилось</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Ниже — диагностика. Скопируйте отчёт и пришлите нам, чтобы мы быстрее помогли.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground break-words">
            <span className="font-semibold text-foreground">Ошибка: </span>
            {this.state.error.message || "Неизвестная ошибка запуска"}
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-2">
              <dt className="text-muted-foreground">Сборка</dt>
              <dd className="font-mono text-foreground">{d.buildVersion.slice(0, 19)}</dd>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-2">
              <dt className="text-muted-foreground">API</dt>
              <dd>
                <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${apiBadge}`}>
                  {apiLabel}
                </span>
                {d.apiDetail && (
                  <span className="ml-2 font-mono text-muted-foreground">{d.apiDetail}</span>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-2">
              <dt className="text-muted-foreground">Сеть</dt>
              <dd className="font-mono text-foreground">{d.online ? "online" : "offline"}</dd>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-2 sm:col-span-2">
              <dt className="text-muted-foreground">Service Worker</dt>
              <dd className="ml-2 truncate font-mono text-foreground">{d.serviceWorker}</dd>
            </div>
          </dl>

          <details className="mt-3 rounded-md border border-border bg-background/50 p-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Ошибки консоли ({d.consoleErrors.length})
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-foreground">
              {d.consoleErrors.length ? d.consoleErrors.join("\n") : "—"}
            </pre>
          </details>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={this.handleCopy}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              {this.state.copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
              {this.state.copied ? "Скопировано" : "Скопировать отчёт"}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <RefreshCcw className="h-4 w-4" />
              Обновить
            </button>
            <button
              type="button"
              onClick={() => void resetBrowserState()}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-navy-light"
            >
              <Trash2 className="h-4 w-4" />
              Очистить и открыть
            </button>
          </div>
        </section>
      </main>
    );
  }
}
