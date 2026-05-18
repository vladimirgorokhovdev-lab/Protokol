import type { TranscriptSegment } from "@/lib/transcript";
import {
  formatSegmentTextForExport,
  normalizeSegmentText,
} from "@/lib/transcript";
import { type TemplateType, getTemplate, buildMeta } from "@/lib/exportTemplates";
import type { AISummaryExport } from "@/components/ExportDialog";

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const PRINT_STYLES = `
  @page { size: A4; margin: 25mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
  }
  .title {
    text-align: center;
    font-size: 16pt;
    font-weight: bold;
    margin-bottom: 4pt;
    letter-spacing: 1px;
    color: #1b3a5c;
  }
  .date {
    text-align: center;
    font-size: 10pt;
    color: #666;
    margin-bottom: 16pt;
  }
  .meta { font-size: 11pt; margin-bottom: 4pt; text-align: left; }
  .divider { border-bottom: 2px solid #1b3a5c; margin: 16pt 0; }
  .divider-light { border-bottom: 1px solid #999; margin: 16pt 0; }
  .section-title {
    font-size: 13pt;
    font-weight: bold;
    color: #1b3a5c;
    margin: 16pt 0 10pt 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .segment {
    margin-bottom: 12pt;
    page-break-inside: avoid;
  }
  .segment-header { margin-bottom: 4pt; text-align: left; }
  .time { font-size: 10pt; color: #666; }
  .speaker { font-weight: bold; font-size: 11pt; color: #1b3a5c; }
  .text-para {
    font-size: 11pt;
    margin: 0 0 6pt 0;
    text-align: justify;
    text-indent: 1.25cm;
  }
  .text-para:last-child { margin-bottom: 0; }
  .footer {
    text-align: center;
    font-size: 9pt;
    color: #999;
    margin-top: 24pt;
    border-top: 2px solid #1b3a5c;
    padding-top: 8pt;
  }
  .ai-section { margin-bottom: 16pt; }
  .ai-section ul { margin: 0 0 8pt 20pt; padding: 0; }
  .ai-section li { margin-bottom: 4pt; font-size: 11pt; text-align: justify; }
  .assignee { color: #666; font-style: italic; }
  .print-hint {
    margin-bottom: 16pt;
    padding: 10pt 12pt;
    border: 1px solid #c9a84c;
    background: #fffbeb;
    font-size: 10pt;
    line-height: 1.4;
    text-align: left;
    text-indent: 0;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-hint { display: none !important; }
  }
`;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Абзацы и переносы строк → HTML */
export function textToHtmlParagraphs(text: string): string {
  const formatted = formatSegmentTextForExport(text);
  if (!formatted) {
    return '<p class="text-para">&nbsp;</p>';
  }

  const paragraphs = formatted.split(/\n\n+/).filter((p) => p.length > 0);
  return paragraphs
    .map(
      (p) =>
        `<p class="text-para">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");
}

/** Печать только HTML протокола (отдельная вкладка — без колонтитулов /history) */
export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const printWindow = window.open("about:blank", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      reject(new Error("POPUP_BLOCKED"));
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    const runPrint = () => {
      printWindow.focus();
      printWindow.print();

      const finish = () => {
        if (!printWindow.closed) {
          printWindow.close();
        }
        resolve();
      };

      printWindow.onafterprint = finish;
      setTimeout(finish, 60_000);
    };

    printWindow.onload = () => setTimeout(runPrint, 350);
    setTimeout(runPrint, 350);
  });
}

export async function exportToPdf(
  segments: TranscriptSegment[],
  _filename = "transcription.pdf",
  templateType: TemplateType = "court",
  aiSummary?: AISummaryExport,
  includeTimecodes = true,
) {
  const template = getTemplate(templateType);
  const meta = buildMeta(segments);
  const headerLines = template.buildHeader(meta);

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${escapeHtml(template.title)}</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="print-hint">
    При сохранении в PDF отключите «Колонтитулы» / Headers and footers в настройках печати браузера.
  </div>
  <div class="title">${escapeHtml(template.title)}</div>
  <div class="date">Дата формирования: ${escapeHtml(meta.date)}</div>
  <div class="divider"></div>
  ${headerLines.map((l) => `<div class="meta">${escapeHtml(l)}</div>`).join("\n")}
  <div class="divider-light"></div>
  ${
    aiSummary
      ? `
  <div class="ai-section">
    <div class="section-title">AI-Резюме</div>
    ${textToHtmlParagraphs(aiSummary.summary)}
    ${
      aiSummary.keyPoints.length
        ? `<div style="font-weight:bold;font-size:11pt;color:#1b3a5c;margin:12pt 0 4pt 0;">Ключевые моменты:</div><ul>${aiSummary.keyPoints.map((p) => `<li>${escapeHtml(normalizeSegmentText(p))}</li>`).join("")}</ul>`
        : ""
    }
    ${
      aiSummary.actionItems.length
        ? `<div style="font-weight:bold;font-size:11pt;color:#1b3a5c;margin:12pt 0 4pt 0;">Задачи:</div><ul>${aiSummary.actionItems.map((a) => `<li>${escapeHtml(normalizeSegmentText(a.task))}${a.assignee ? ` <span class="assignee">— ${escapeHtml(a.assignee)}</span>` : ""}</li>`).join("")}</ul>`
        : ""
    }
  </div>
  <div class="divider-light"></div>
  `
      : ""
  }
  <div class="section-title">Содержание расшифровки</div>
  ${segments
    .map(
      (s) => `
    <div class="segment">
      <div class="segment-header">
        ${
          includeTimecodes
            ? `<span class="time">[${formatTime(s.startTime)} – ${formatTime(s.endTime)}]</span> `
            : ""
        }<span class="speaker">${escapeHtml(s.speaker)}</span>
      </div>
      ${textToHtmlParagraphs(s.text)}
    </div>`,
    )
    .join("\n")}
  <div class="footer">Сформировано в ПротоколЪ · ${escapeHtml(meta.date)}</div>
</body>
</html>`;

  await printHtmlDocument(html);
}
