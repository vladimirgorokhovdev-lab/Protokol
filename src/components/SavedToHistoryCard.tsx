import { CheckCircle2, History, X } from "lucide-react";
import { motion } from "framer-motion";

interface SavedToHistoryCardProps {
  fileName: string;
  segmentCount?: number;
  onOpenHistory: () => void;
  onDismiss: () => void;
}

export function SavedToHistoryCard({
  fileName,
  segmentCount,
  onOpenHistory,
  onDismiss,
}: SavedToHistoryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 flex items-start gap-3"
    >
      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Файл загружен и сохранён в{" "}
          <span className="font-medium text-foreground">Истории</span>
          {segmentCount != null && segmentCount > 0
            ? ` · ${segmentCount} фрагментов`
            : null}
          . Откройте историю, чтобы прослушать и редактировать.
        </p>
        <button
          type="button"
          onClick={onOpenHistory}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-primary-foreground text-xs font-medium hover:bg-navy-light transition-colors"
        >
          <History className="w-3.5 h-3.5" />
          Перейти в историю
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
        aria-label="Скрыть"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
