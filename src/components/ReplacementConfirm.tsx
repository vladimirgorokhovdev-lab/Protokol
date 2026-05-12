import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReplacementMatch {
  segmentIndex: number;
  find: string;
  replace: string;
  startPos: number;
}

interface ReplacementConfirmProps {
  matches: ReplacementMatch[];
  onConfirm: (accepted: ReplacementMatch[]) => void;
  onDismiss: () => void;
}

export function ReplacementConfirm({ matches, onConfirm, onDismiss }: ReplacementConfirmProps) {
  const [decisions, setDecisions] = useState<Record<number, boolean>>({});

  const toggleDecision = (index: number) => {
    setDecisions((prev) => ({ ...prev, [index]: prev[index] === undefined ? false : !prev[index] }));
  };

  const isAccepted = (index: number) => decisions[index] !== false;

  const handleApply = () => {
    const accepted = matches.filter((_, i) => isAccepted(i));
    onConfirm(accepted);
  };

  const acceptedCount = matches.filter((_, i) => isAccepted(i)).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-card border border-gold/20 p-4 mb-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-serif font-semibold text-sm text-foreground">
          Предложения замены ({matches.length})
        </h4>
        <button onClick={onDismiss} className="p-1 rounded hover:bg-muted transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto mb-3">
        {matches.map((m, i) => (
          <button
            key={i}
            onClick={() => toggleDecision(i)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
              isAccepted(i) ? "bg-gold/10 border border-gold/20" : "bg-muted/50 border border-transparent opacity-60"
            }`}
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
              isAccepted(i) ? "bg-gold text-white" : "bg-muted border border-border"
            }`}>
              {isAccepted(i) && <Check className="w-3 h-3" />}
            </div>
            <span className="text-sm line-through text-muted-foreground truncate">{m.find}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{m.replace}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {acceptedCount} из {matches.length} выбрано
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDismiss} className="h-7 text-xs">
            Пропустить
          </Button>
          <Button size="sm" onClick={handleApply} className="h-7 text-xs bg-navy hover:bg-navy-light text-primary-foreground" disabled={acceptedCount === 0}>
            Применить
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export type { ReplacementMatch };
