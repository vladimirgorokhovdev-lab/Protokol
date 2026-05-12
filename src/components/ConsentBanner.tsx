import { forwardRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, X } from "lucide-react";

const STORAGE_KEY = "protokol_consent_v1";

type ConsentState = {
  necessary: true;
  analytics: boolean;
  acceptedAt: string;
};

const ConsentBanner = forwardRef<HTMLDivElement>((_, ref) => {
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // небольшая задержка, чтобы не перекрывать первый кадр
        const t = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  const save = (state: ConsentState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const acceptAll = () =>
    save({ necessary: true, analytics: true, acceptedAt: new Date().toISOString() });

  const acceptNecessary = () =>
    save({ necessary: true, analytics: false, acceptedAt: new Date().toISOString() });

  const acceptSelected = () =>
    save({ necessary: true, analytics, acceptedAt: new Date().toISOString() });

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-live="polite"
      aria-label="Согласие на обработку персональных данных и cookie"
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-4 sm:pb-4 animate-in slide-in-from-bottom-8 duration-500"
    >
      <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl">
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-navy items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm sm:text-base font-semibold font-playfair text-foreground">
                Обработка персональных данных и cookie
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1">
                Сайт «ПротоколЪ» использует файлы cookie и обрабатывает технические данные
                (IP-адрес, тип устройства, действия на сайте) в соответствии с{" "}
                <Link
                  to="/privacy"
                  className="text-gold-dark hover:underline font-medium"
                  target="_blank"
                  rel="noopener"
                >
                  Политикой конфиденциальности
                </Link>{" "}
                и Федеральным законом № 152-ФЗ. Вы можете выбрать, какие категории cookie разрешить.
              </p>
            </div>
            <button
              onClick={acceptNecessary}
              aria-label="Закрыть и принять только необходимые"
              className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-2 sm:gap-3 sm:pl-13">
            <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-2.5 cursor-not-allowed opacity-90">
              <input
                type="checkbox"
                checked
                disabled
                className="mt-0.5 w-4 h-4 rounded accent-gold shrink-0"
              />
              <span className="text-xs leading-snug">
                <span className="font-medium text-foreground">Необходимые</span>
                <span className="block text-muted-foreground mt-0.5">
                  Авторизация, безопасность, работа сервиса. Всегда включены.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5 cursor-pointer hover:border-gold/50 transition-colors">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border accent-gold shrink-0"
              />
              <span className="text-xs leading-snug">
                <span className="font-medium text-foreground">Аналитика</span>
                <span className="block text-muted-foreground mt-0.5">
                  Анонимная статистика использования для улучшения сервиса.
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end sm:items-center sm:pl-13">
            <button
              onClick={acceptNecessary}
              className="px-4 py-2 rounded-xl text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors"
            >
              Только необходимые
            </button>
            <button
              onClick={acceptSelected}
              className="px-4 py-2 rounded-xl text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors"
            >
              Сохранить выбор
            </button>
            <button
              onClick={acceptAll}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-navy text-primary-foreground hover:bg-navy-light transition-colors"
            >
              Принять все
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

ConsentBanner.displayName = "ConsentBanner";

export default ConsentBanner;

export const getConsent = (): ConsentState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConsentState) : null;
  } catch {
    return null;
  }
};

export const resetConsent = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};
