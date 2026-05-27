import { History } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryNavButtonProps {
  onClick: () => void;
  totalCount: number;
  newCount: number;
  className?: string;
  variant?: "desktop" | "mobile";
}

export function HistoryNavButton({
  onClick,
  totalCount,
  newCount,
  className,
  variant = "desktop",
}: HistoryNavButtonProps) {
  const hasNew = newCount > 0;
  const showCount = totalCount > 0;

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-left w-full",
          hasNew && "ring-1 ring-gold/30 bg-gold/5",
          className,
        )}
      >
        <History
          className={cn("w-4 h-4", hasNew ? "text-gold" : "text-muted-foreground")}
        />
        История
        {showCount && (
          <span
            className={cn(
              "ml-auto min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1.5",
              hasNew ? "bg-gold text-navy" : "bg-muted text-muted-foreground",
            )}
          >
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-[13px]",
        hasNew
          ? "text-foreground ring-1 ring-gold/40 bg-gold/5"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <History className={cn("w-4 h-4", hasNew && "text-gold")} />
      История
      {showCount && (
        <span
          className={cn(
            "min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-bold px-1",
            hasNew ? "bg-gold text-navy" : "bg-muted text-muted-foreground",
          )}
        >
          {totalCount > 99 ? "99+" : totalCount}
        </span>
      )}
      {hasNew && (
        <span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gold ring-2 ring-card"
          aria-hidden
        />
      )}
    </button>
  );
}
