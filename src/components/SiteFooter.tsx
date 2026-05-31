import { Link } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { resetCacheAndReload } from "@/lib/cacheReset";
import { CopySiteUrlButton } from "@/components/CopySiteUrlButton";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="container max-w-6xl mx-auto px-4 py-4 flex flex-col items-center gap-3">
        <CopySiteUrlButton />
      </div>
      <div className="container max-w-6xl mx-auto px-4 pb-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
        <span>ПротоколЪ · Конфиденциальная обработка аудиоданных</span>
        <span className="hidden sm:inline">·</span>
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          <Link to="/guide" className="hover:text-foreground transition-colors">Руководство</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Оферта</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Конфиденциальность</Link>
          
          <button
            onClick={resetCacheAndReload}
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Сбросить кэш
          </button>
        </nav>
      </div>
    </footer>
  );
}
