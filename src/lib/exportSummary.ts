import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import type { AISummaryExport } from "@/components/ExportDialog";
import { printHtmlDocument, textToHtmlParagraphs } from "@/lib/exportPdf";


const SENTIMENT_LABELS: Record<string, string> = {
  neutral: "Нейтральный", positive: "Позитивный", negative: "Негативный",
  confrontational: "Конфронтационный", cooperative: "Конструктивный",
};

export async function exportSummaryToDocx(ai: AISummaryExport) {
  const children: Paragraph[] = [];
  const date = new Date().toLocaleDateString("ru-RU");

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: "AI-РЕЗЮМЕ РАСШИФРОВКИ", bold: true, size: 32, font: "Times New Roman" })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: `Дата формирования: ${date}`, size: 20, color: "666666", font: "Times New Roman" })],
  }));

  children.push(new Paragraph({
    spacing: { before: 100, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1B3A5C", space: 1 } },
    children: [],
  }));

  children.push(new Paragraph({
    spacing: { after: 160 },
    children: [
      new TextRun({ text: "Тон обсуждения: ", bold: true, size: 22, font: "Times New Roman" }),
      new TextRun({ text: SENTIMENT_LABELS[ai.sentiment] || ai.sentiment, size: 22, font: "Times New Roman", italics: true }),
    ],
  }));

  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: "РЕЗЮМЕ", bold: true, size: 24, font: "Times New Roman", color: "1B3A5C" })],
  }));
  children.push(new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 720 },
    children: [new TextRun({ text: ai.summary, size: 22, font: "Times New Roman" })],
  }));

  if (ai.keyPoints.length) {
    children.push(new Paragraph({
      spacing: { before: 100, after: 80 },
      children: [new TextRun({ text: "КЛЮЧЕВЫЕ МОМЕНТЫ", bold: true, size: 24, font: "Times New Roman", color: "1B3A5C" })],
    }));
    for (const p of ai.keyPoints) {
      children.push(new Paragraph({
        spacing: { after: 60 },
        bullet: { level: 0 },
        children: [new TextRun({ text: p, size: 22, font: "Times New Roman" })],
      }));
    }
  }


  if (ai.actionItems.length) {
    children.push(new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [new TextRun({ text: "ЗАДАЧИ И ПОРУЧЕНИЯ", bold: true, size: 24, font: "Times New Roman", color: "1B3A5C" })],
    }));
    for (const a of ai.actionItems) {
      children.push(new Paragraph({
        spacing: { after: 60 },
        bullet: { level: 0 },
        children: [
          new TextRun({ text: a.task, size: 22, font: "Times New Roman" }),
          ...(a.assignee ? [new TextRun({ text: ` — ${a.assignee}`, size: 22, font: "Times New Roman", italics: true, color: "666666" })] : []),
        ],
      }));
    }
  }

  children.push(new Paragraph({
    spacing: { before: 300 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1B3A5C", space: 1 } },
    children: [],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100 },
    children: [new TextRun({ text: "Сформировано в ПротоколЪ · " + date, size: 18, color: "999999", font: "Times New Roman" })],
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, "ai_summary.docx");
}

export async function exportSummaryToPdf(ai: AISummaryExport) {
  const date = new Date().toLocaleDateString("ru-RU");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 25mm; }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; text-align: justify; }
    .title { text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 4pt; letter-spacing: 1px; }
    .date { text-align: center; font-size: 10pt; color: #666; margin-bottom: 16pt; }
    .divider { border-bottom: 2px solid #1B3A5C; margin: 16pt 0; }
    .section-title { font-size: 12pt; font-weight: bold; color: #1B3A5C; margin: 16pt 0 8pt 0; text-transform: uppercase; }
    .summary { margin-bottom: 12pt; text-indent: 1.25cm; }
    .sentiment { margin-bottom: 12pt; }
    .sentiment b { font-weight: bold; }
    ul { margin: 0 0 8pt 20pt; padding: 0; }
    li { margin-bottom: 4pt; }
    .entity-type { color: #666; font-size: 10pt; }
    .assignee { color: #666; font-style: italic; }
    .footer { text-align: center; font-size: 9pt; color: #999; margin-top: 24pt; border-top: 2px solid #1B3A5C; padding-top: 8pt; }
  </style></head><body>
    <div class="title">AI-РЕЗЮМЕ РАСШИФРОВКИ</div>
    <div class="date">Дата формирования: ${date}</div>
    <div class="divider"></div>
    <div class="sentiment"><b>Тон обсуждения:</b> <i>${esc(SENTIMENT_LABELS[ai.sentiment] || ai.sentiment)}</i></div>
    <div class="section-title">Резюме</div>
    ${textToHtmlParagraphs(ai.summary)}
    ${ai.keyPoints.length ? `<div class="section-title">Ключевые моменты</div><ul>${ai.keyPoints.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
    ${ai.actionItems.length ? `<div class="section-title">Задачи и поручения</div><ul>${ai.actionItems.map(a => `<li>${esc(a.task)}${a.assignee ? ` <span class="assignee">— ${esc(a.assignee)}</span>` : ""}</li>`).join("")}</ul>` : ""}
    <div class="footer">Сформировано в ПротоколЪ · ${date}</div>
  </body></html>`;

  await printHtmlDocument(html);
}
