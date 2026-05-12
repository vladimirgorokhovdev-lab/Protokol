import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Check, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-10 h-10 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground font-playfair">
          Установить Протокол<span className="text-primary">Ъ</span>
        </h1>

        <p className="text-muted-foreground">
          Установите приложение на домашний экран для быстрого доступа. Работает без интернета и выглядит как нативное приложение.
        </p>

        {installed ? (
          <div className="flex items-center justify-center gap-2 text-green-500">
            <Check className="w-5 h-5" />
            <span className="font-medium">Приложение установлено!</span>
          </div>
        ) : deferredPrompt ? (
          <Button onClick={handleInstall} size="lg" className="w-full gap-2">
            <Download className="w-5 h-5" />
            Установить приложение
          </Button>
        ) : isIOS ? (
          <div className="space-y-3 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
            <p className="font-medium text-foreground">Инструкция для iOS:</p>
            <ol className="text-left space-y-2 list-decimal list-inside">
              <li>Нажмите кнопку <strong>«Поделиться»</strong> (квадрат со стрелкой вверх)</li>
              <li>Прокрутите вниз и нажмите <strong>«На экран «Домой»»</strong></li>
              <li>Нажмите <strong>«Добавить»</strong></li>
            </ol>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
            <p className="font-medium text-foreground">Инструкция:</p>
            <ol className="text-left space-y-2 list-decimal list-inside">
              <li>Откройте меню браузера (три точки)</li>
              <li>Нажмите <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong></li>
            </ol>
          </div>
        )}

        <a href="/" className="inline-block text-sm text-primary hover:underline">
          ← Вернуться к приложению
        </a>
      </div>
    </div>
  );
};

export default Install;
