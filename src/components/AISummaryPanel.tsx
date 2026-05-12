import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  Copy,
  EyeOff,
  Eye,
  Lock,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { saveAiSummary, loadAiSummary } from "@/lib/transcriptionStorage";
import { useSubscription } from "@/hooks/useSubscription";
import type { TranscriptSegment } from "@/lib/transcript";

interface AISummaryData {
  summary: string;
  keyPoints: string[];
  actionItems: { task: string; assignee?: string }[];
  sentiment: string;
}

const SENTIMENT_LABELS: Record<string, { label: string; color: string }> = {
  neutral: { label: "Нейтральный", color: "text-muted-foreground" },
  positive: { label: "Позитивный", color: "text-green-400" },
  negative: { label: "Негативный", color: "text-red-400" },
  confrontational: { label: "Конфронтационный", color: "text-orange-400" },
  cooperative: { label: "Конструктивный", color: "text-blue-400" },
};

interface AISummaryPanelProps {
  segments: TranscriptSegment[];
  speakerNames?: Record<string, string>;
  onSummaryData?: (data: AISummaryData | null) => void;
  transcriptionId?: string;
}

export type { AISummaryData };

const formatSummaryText = (
  d: AISummaryData,
  participants: string[] = [],
): string => {
  const lines: string[] = [];
  lines.push("=== AI-РЕЗЮМЕ ===\n");
  lines.push(d.summary);
  lines.push(
    `\nТон: ${(SENTIMENT_LABELS[d.sentiment] || SENTIMENT_LABELS.neutral).label}`,
  );
  if (participants.length) {
    lines.push("\n--- Участники ---");
    participants.forEach((p) => lines.push(`• ${p}`));
  }
  if (d.keyPoints.length) {
    lines.push("\n--- Ключевые моменты ---");
    d.keyPoints.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  }
  if (d.actionItems.length) {
    lines.push("\n--- Задачи ---");
    d.actionItems.forEach((a) =>
      lines.push(`☐ ${a.task}${a.assignee ? ` — ${a.assignee}` : ""}`),
    );
  }
  return lines.join("\n");
};

const AISummaryPanel = ({
  segments,
  speakerNames,
  onSummaryData,
  transcriptionId,
}: AISummaryPanelProps) => {
  const { tier, loading: subLoading } = useSubscription();
  const isPro = tier === "pro";
  const [data, setData] = useState<AISummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState({
    keyPoints: true,
    actions: true,
    participants: true,
  });

  const participants = useMemo(() => {
    const set = new Set<string>();
    segments.forEach((s) => {
      const name = speakerNames?.[s.speaker]?.trim() || s.speaker;
      if (name) set.add(name);
    });
    return Array.from(set);
  }, [segments, speakerNames]);

  useEffect(() => {
    if (!transcriptionId) return;
    loadAiSummary(transcriptionId).then((saved) => {
      if (saved) {
        const summaryData = saved as unknown as AISummaryData;
        setData(summaryData);
        onSummaryData?.(summaryData);
      }
    });
  }, [transcriptionId]);

  const analyze = async () => {
    if (!isPro) {
      toast({
        title: "Доступно в тарифе «Про»",
        description:
          "AI-резюме входит в тариф «Про». Откройте раздел тарифов, чтобы оформить подписку.",
      });
      return;
    }
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke(
        "ai-summary",
        {
          body: { segments, speakerNames },
        },
      );

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      setData(result);
      onSummaryData?.(result);
      setExpanded(true);
      if (transcriptionId) {
        saveAiSummary(transcriptionId, result);
      }
    } catch (e: any) {
      console.error("AI summary error:", e);
      toast({
        title: "Ошибка анализа",
        description: e.message || "Не удалось получить AI-резюме",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (key: keyof typeof sectionsOpen) =>
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!data) {
    if (!subLoading && !isPro) {
      return (
        <Link
          to="/pricing"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-gold/20 to-gold/10 border border-gold/30 hover:border-gold/50 text-gold transition-all text-sm font-medium"
          title="AI-резюме доступно в тарифе «Про»"
        >
          <Lock className="w-4 h-4" />
          AI-резюме · тариф «Про»
        </Link>
      );
    }
    return (
      <button
        onClick={analyze}
        disabled={loading || subLoading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-gold/20 to-gold/10 border border-gold/30 hover:border-gold/50 text-gold transition-all text-sm font-medium disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {loading ? "Анализ..." : "AI-резюме"}
      </button>
    );
  }

  const sentiment =
    SENTIMENT_LABELS[data.sentiment] || SENTIMENT_LABELS.neutral;

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-gold/20 to-gold/10 border border-gold/30 hover:border-gold/50 text-gold transition-all text-sm font-medium"
      >
        <Eye className="w-4 h-4" />
        Показать AI-резюме
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-gold/30 bg-gradient-to-br from-gold/5 to-transparent mb-6 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gold/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <span className="font-serif font-semibold text-foreground">
            AI-анализ
          </span>
          <span className={`text-xs ${sentiment.color}`}>
            · {sentiment.label} тон
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (data) {
                navigator.clipboard.writeText(
                  formatSummaryText(data, participants),
                );
                toast({
                  title: "Скопировано",
                  description: "AI-резюме скопировано в буфер обмена",
                });
              }
            }}
            className="text-xs text-muted-foreground hover:text-gold transition-colors flex items-center gap-1"
          >
            <Copy className="w-3 h-3" /> Копировать
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              analyze();
            }}
            disabled={loading}
            className="text-xs text-muted-foreground hover:text-gold transition-colors"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              "Обновить"
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setHidden(true);
            }}
            className="text-xs text-muted-foreground hover:text-gold transition-colors flex items-center gap-1"
            title="Скрыть AI-резюме"
          >
            <EyeOff className="w-3 h-3" /> Скрыть
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              <div>
                <p className="text-foreground leading-relaxed text-sm text-justify indent-8">
                  {data.summary}
                </p>
              </div>

              {participants.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection("participants")}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
                  >
                    {sectionsOpen.participants ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    <Users className="w-3 h-3" />
                    Участники ({participants.length})
                  </button>
                  {sectionsOpen.participants && (
                    <div className="flex flex-wrap gap-1.5">
                      {participants.map((p, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 rounded-md bg-gold/10 border border-gold/20 text-foreground"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <button
                  onClick={() => toggleSection("keyPoints")}
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
                >
                  {sectionsOpen.keyPoints ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  Ключевые моменты ({data.keyPoints.length})
                </button>
                {sectionsOpen.keyPoints && (
                  <ul className="space-y-1.5">
                    {data.keyPoints.map((point, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-sm text-foreground"
                      >
                        <span className="text-gold mt-0.5 flex-shrink-0">
                          •
                        </span>
                        <span className="text-justify">{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {data.actionItems.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection("actions")}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
                  >
                    {sectionsOpen.actions ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    Задачи ({data.actionItems.length})
                  </button>
                  {sectionsOpen.actions && (
                    <ul className="space-y-1.5">
                      {data.actionItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-foreground">{item.task}</span>
                            {item.assignee && (
                              <span className="text-muted-foreground ml-1">
                                — {item.assignee}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AISummaryPanel;
