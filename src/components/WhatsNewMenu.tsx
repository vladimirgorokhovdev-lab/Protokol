import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WHATS_NEW, WHATS_NEW_VERSION } from "@/lib/whatsNew";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale/ru";

const STORAGE_KEY = "protokolъ:whatsNewSeen";

interface WhatsNewMenuProps {
  variant?: "desktop" | "mobile";
}

export function WhatsNewMenu({ variant = "desktop" }: WhatsNewMenuProps) {
  const [open, setOpen] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    setHasUnseen(seen !== WHATS_NEW_VERSION);
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && hasUnseen) {
      localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION);
      setHasUnseen(false);
    }
  };

  if (variant === "mobile") {
    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button className="relative flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left w-full">
            <Sparkles className="w-4 h-4 text-gold" />
            Новое
            {hasUnseen && (
              <span className="ml-auto inline-block w-2 h-2 rounded-full bg-gold" aria-label="Есть новое" />
            )}
          </button>
        </PopoverTrigger>
        <WhatsNewContent />
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-[13px] text-muted-foreground hover:text-foreground"
          title="Новые функции"
        >
          <Sparkles className="w-4 h-4 text-gold" />
          Новое
          {hasUnseen && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-gold ring-2 ring-card" aria-label="Есть новое" />
          )}
        </button>
      </PopoverTrigger>
      <WhatsNewContent />
    </Popover>
  );
}

function WhatsNewContent() {
  return (
    <PopoverContent align="end" className="w-[340px] sm:w-[380px] p-0 max-h-[70vh] overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-gold" />
        <h3 className="font-serif font-semibold text-sm text-foreground">Что нового</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">Последние 5 функций</span>
      </div>
      <ol className="overflow-y-auto divide-y divide-border">
        {WHATS_NEW.slice(0, 5).map((item, i) => {
          let formattedDate = item.date;
          try {
            formattedDate = format(parseISO(item.date), "d MMM yyyy", { locale: ru });
          } catch { /* keep raw */ }
          return (
            <li key={i} className="px-4 py-3 hover:bg-muted/40 transition-colors">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <h4 className="text-sm font-medium text-foreground leading-snug">{item.title}</h4>
                <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">{formattedDate}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </li>
          );
        })}
      </ol>
    </PopoverContent>
  );
}
