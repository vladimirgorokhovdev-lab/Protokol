import type { TranscriptSegment } from "@/lib/transcript";
import { normalizeSegmentText } from "@/lib/transcript";
import { type TemplateType, getTemplate, buildMeta } from "@/lib/exportTemplates";
import type { AISummaryExport } from "@/components/ExportDialog";

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export async function exportToPdf(
  segments: TranscriptSegment[],
  filename = "transcription.pdf",
  templateType: TemplateType = "court",
  aiSummary?: AISummaryExport,
  includeTimecodes = true,
) {
  const template = getTemplate(templateType);
  const meta = buildMeta(segments);
  const headerLines = template.buildHeader(meta);

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 25mm; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #1a1a1a; text-align: justify; }
  .title { text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 4pt; letter-spacing: 1px; color: #1B3A5C; }
  .date { text-align: center; font-size: 10pt; color: #666; margin-bottom: 16pt; }
  .meta { font-size: 11pt; margin-bottom: 4pt; }
  .divider { border-bottom: 2px solid #1B3A5C; margin: 16pt 0; }
  .divider-light { border-bottom: 1px solid #999; margin: 16pt 0; }
  .section-title { font-size: 13pt; font-weight: bold; color: #1B3A5C; margin: 16pt 0 10pt 0; text-transform: uppercase; letter-spacing: 0.5px; }
  .segment { margin-bottom: 10pt; }
  .segment-header { margin-bottom: 2pt; }
  .time { font-size: 10pt; color: #666; }
  .speaker { font-weight: bold; font-size: 11pt; color: #1B3A5C; }
  .text { font-size: 11pt; margin-left: 0; text-indent: 1.25cm; }
  .footer { text-align: center; font-size: 9pt; color: #999; margin-top: 24pt; border-top: 2px solid #1B3A5C; padding-top: 8pt; text-indent: 0; }
  .ai-section { margin-bottom: 16pt; }
  .ai-section ul { margin: 0 0 8pt 20pt; padding: 0; }
  .ai-section li { margin-bottom: 4pt; font-size: 11pt; }
  .entity-type { color: #666; font-size: 10pt; }
  .assignee { color: #666; font-style: italic; }
</style>
</head>
<body>
  <div class="title">${template.title}</div>
  <div class="date">Дата формирования: ${meta.date}</div>
  <div class="divider"></div>
  ${headerLines.map((l) => `<div class="meta">${escapeHtml(l)}</div>`).join("\n")}
  <div class="divider-light"></div>
  ${aiSummary ? `
  <div class="ai-section">
    <div class="section-title">AI-Резюме</div>
    <div class="text" style="margin-bottom: 10pt;">${escapeHtml(aiSummary.summary)}</div>
    ${aiSummary.keyPoints.length ? `<div style="font-weight: bold; font-size: 11pt; color: #1B3A5C; margin-bottom: 4pt;">Ключевые моменты:</div><ul>${aiSummary.keyPoints.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>` : ""}
    ${aiSummary.actionItems.length ? `<div style="font-weight: bold; font-size: 11pt; color: #1B3A5C; margin-bottom: 4pt;">Задачи:</div><ul>${aiSummary.actionItems.map(a => `<li>${escapeHtml(a.task)}${a.assignee ? ` <span class="assignee">— ${escapeHtml(a.assignee)}</span>` : ""}</li>`).join("")}</ul>` : ""}
  </div>
  <div class="divider-light"></div>
  ` : ""}
  <div class="section-title">Содержание расшифровки</div>
  ${segments
    .map(
      (s) => `
    <div class="segment">
      <div class="segment-header">
        ${includeTimecodes ? `<span class="time">[${formatTime(s.startTime)} – ${formatTime(s.endTime)}]</span> ` : ""}<span class="speaker">${escapeHtml(s.speaker)}</span>
      </div>
      <div class="text">${escapeHtml(normalizeSegmentText(s.text))}</div>
    </div>`
    )
    .join("\n")}
  <div class="footer">Сформировано в ПротоколЪ · ${meta.date}</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.width = "210mm";
  iframe.style.height = "297mm";
  document.body.appendChild(iframe);

  iframe.src = url;

  await new Promise<void>((resolve) => {
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
        } catch {
          window.open(url, "_blank");
        }
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
          resolve();
        }, 1000);
      }, 300);
    };
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
