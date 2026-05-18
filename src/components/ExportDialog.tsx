import { useState } from "react";
import { FileText, FileDown, X, Check, Sparkles } from "lucide-react";
import { templates, type TemplateType } from "@/lib/exportTemplates";
import { exportToDocx } from "@/lib/exportDocx";
import { exportToPdf } from "@/lib/exportPdf";
import { exportSummaryToDocx, exportSummaryToPdf } from "@/lib/exportSummary";
import type { TranscriptSegment } from "@/lib/transcript";
import { toast } from "@/hooks/use-toast";

export interface AISummaryExport {
  summary: string;
  keyPoints: string[];
  actionItems: { task: string; assignee?: string }[];
  sentiment: string;
}

interface ExportDialogProps {
  segments: TranscriptSegment[];
  onClose: () => void;
  aiSummary?: AISummaryExport | null;
}

const ExportDialog = ({ segments, onClose, aiSummary }: ExportDialogProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("court");
  const [exporting, setExporting] = useState(false);
  const [includeSummary, setIncludeSummary] = useState(false);
  const [includeTimecodes, setIncludeTimecodes] = useState(true);
  const [pendingFormat, setPendingFormat] = useState<"docx" | "pdf" | null>(null);

  const runExport = async (format: "docx" | "pdf") => {
    setExporting(true);
    try {
      const summaryData = includeSummary ? (aiSummary || undefined) : undefined;
      if (format === "docx") {
        await exportToDocx(segments, `protocol_${selectedTemplate}.docx`, selectedTemplate, summaryData, includeTimecodes);
      } else {
        await exportToPdf(segments, `protocol_${selectedTemplate}.pdf`, selectedTemplate, summaryData, includeTimecodes);
      }
      if (format === "pdf") {
        toast({
          title: "Печать протокола",
          description:
            "Откроется вкладка с документом. В настройках печати отключите «Колонтитулы», затем «Сохранить как PDF».",
        });
      } else {
        toast({ title: "Экспорт", description: "Файл .docx сформирован" });
      }
      onClose();
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "POPUP_BLOCKED"
          ? "Разрешите всплывающие окна для сайта — иначе PDF не откроется"
          : "Не удалось экспортировать";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setExporting(false);
      setPendingFormat(null);
    }
  };

  const handleExport = (format: "docx" | "pdf") => {
    setPendingFormat(format);
  };

  const templateName = templates.find((t) => t.id === selectedTemplate)?.name ?? selectedTemplate;

  const handleExportSummaryOnly = async (format: "docx" | "pdf") => {
    if (!aiSummary) return;
    try {
      if (format === "docx") {
        await exportSummaryToDocx(aiSummary);
      } else {
        await exportSummaryToPdf(aiSummary);
      }
      toast({ title: "Экспорт", description: "AI-резюме сформировано" });
    } catch (e) {
      toast({ title: "Ошибка", description: "Не удалось экспортировать резюме", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-serif font-semibold text-foreground">Экспорт протокола</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-3">Выберите шаблон:</p>
        <div className="space-y-2 mb-4">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selectedTemplate === t.id
                  ? "border-gold/50 bg-gold/5"
                  : "border-border hover:border-gold/30"
              }`}
            >
              <div className="flex items-center gap-2">
                {selectedTemplate === t.id && <Check className="w-4 h-4 text-gold" />}
                <span className="font-medium text-sm text-foreground">{t.name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 pl-6">{t.description}</p>
            </button>
          ))}
        </div>

        {aiSummary && (
          <label className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-gold/30 transition-colors cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={includeSummary}
              onChange={(e) => setIncludeSummary(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-gold"
            />
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold" />
              <span className="text-sm text-foreground">Включить AI-резюме в документ</span>
            </div>
          </label>
        )}

        <label className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-gold/30 transition-colors cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={includeTimecodes}
            onChange={(e) => setIncludeTimecodes(e.target.checked)}
            className="w-4 h-4 rounded border-border accent-gold"
          />
          <span className="text-sm text-foreground">Показывать таймкоды в документе</span>
        </label>

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => handleExport("docx")}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-navy text-primary-foreground hover:bg-navy-light transition-colors text-sm font-medium disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            Скачать .docx
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border hover:bg-muted transition-colors text-sm font-medium disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            Печать / PDF
          </button>
        </div>

        {aiSummary && (
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-gold" />
              Экспорт только AI-резюме (отдельный документ)
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleExportSummaryOnly("docx")}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gold/10 border border-gold/30 hover:border-gold/50 text-gold transition-colors text-sm font-medium"
              >
                <FileText className="w-3.5 h-3.5" />
                .docx
              </button>
              <button
                onClick={() => handleExportSummaryOnly("pdf")}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gold/10 border border-gold/30 hover:border-gold/50 text-gold transition-colors text-sm font-medium"
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>
          </div>
        )}
      </div>

      {pendingFormat && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !exporting && setPendingFormat(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-serif font-semibold text-foreground mb-3">
              Подтвердите экспорт
            </h4>
            <p className="text-sm text-muted-foreground mb-3">Проверьте параметры:</p>
            <ul className="text-sm text-foreground space-y-1.5 mb-5">
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Формат:</span>
                <span className="font-medium uppercase">{pendingFormat}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Шаблон:</span>
                <span className="font-medium">{templateName}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Таймкоды:</span>
                <span className="font-medium">{includeTimecodes ? "включены" : "выключены"}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Имена ролей:</span>
                <span className="font-medium">включены</span>
              </li>
              {aiSummary && (
                <li className="flex justify-between gap-3">
                  <span className="text-muted-foreground">AI-резюме:</span>
                  <span className="font-medium">{includeSummary ? "включено" : "выключено"}</span>
                </li>
              )}
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingFormat(null)}
                disabled={exporting}
                className="flex-1 px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors text-sm font-medium disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={() => runExport(pendingFormat)}
                disabled={exporting}
                className="flex-1 px-4 py-2 rounded-xl bg-navy text-primary-foreground hover:bg-navy-light transition-colors text-sm font-medium disabled:opacity-50"
              >
                {exporting ? "Экспорт..." : "Подтвердить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportDialog;
