import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import type { TranscriptSegment } from "@/lib/transcript";
import { normalizeSegmentText } from "@/lib/transcript";
import {
  type TemplateType,
  getTemplate,
  buildMeta,
} from "@/lib/exportTemplates";
import type { AISummaryExport } from "@/components/ExportDialog";

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const NAVY = "1B3A5C";
const GOLD_ACCENT = "C9A84C";
const GRAY = "666666";
const LIGHT_GRAY = "999999";

export async function exportToDocx(
  segments: TranscriptSegment[],
  filename = "transcription.docx",
  templateType: TemplateType = "court",
  aiSummary?: AISummaryExport,
  includeTimecodes = true,
) {
  const template = getTemplate(templateType);
  const meta = buildMeta(segments);
  const headerLines = template.buildHeader(meta);
  const date = new Date().toLocaleDateString("ru-RU");

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: template.title,
          bold: true,
          size: 32,
          font: "Times New Roman",
          color: NAVY,
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Дата формирования: ${date}`,
          size: 20,
          color: GRAY,
          font: "Times New Roman",
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      spacing: { before: 100, after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 1 },
      },
      children: [],
    }),
  );

  for (const line of headerLines) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: line, size: 22, font: "Times New Roman" }),
        ],
      }),
    );
  }

  children.push(
    new Paragraph({
      spacing: { before: 160, after: 200 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 4,
          color: LIGHT_GRAY,
          space: 1,
        },
      },
      children: [],
    }),
  );

  if (aiSummary) {
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 120 },
        children: [
          new TextRun({
            text: "AI-РЕЗЮМЕ",
            bold: true,
            size: 26,
            font: "Times New Roman",
            color: NAVY,
          }),
        ],
      }),
    );
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 720 },
        children: [
          new TextRun({
            text: aiSummary.summary,
            size: 22,
            font: "Times New Roman",
          }),
        ],
      }),
    );
    if (aiSummary.keyPoints.length) {
      children.push(
        new Paragraph({
          spacing: { before: 80 },
          children: [
            new TextRun({
              text: "Ключевые моменты:",
              bold: true,
              size: 22,
              font: "Times New Roman",
              color: NAVY,
            }),
          ],
        }),
      );
      for (const p of aiSummary.keyPoints) {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            bullet: { level: 0 },
            children: [
              new TextRun({ text: p, size: 22, font: "Times New Roman" }),
            ],
          }),
        );
      }
    }
    if (aiSummary.actionItems.length) {
      children.push(
        new Paragraph({
          spacing: { before: 80 },
          children: [
            new TextRun({
              text: "Задачи:",
              bold: true,
              size: 22,
              font: "Times New Roman",
              color: NAVY,
            }),
          ],
        }),
      );
      for (const a of aiSummary.actionItems) {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            bullet: { level: 0 },
            children: [
              new TextRun({ text: a.task, size: 22, font: "Times New Roman" }),
              ...(a.assignee
                ? [
                    new TextRun({
                      text: ` — ${a.assignee}`,
                      size: 22,
                      font: "Times New Roman",
                      italics: true,
                      color: GRAY,
                    }),
                  ]
                : []),
            ],
          }),
        );
      }
    }
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 200 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 4,
            color: LIGHT_GRAY,
            space: 1,
          },
        },
        children: [],
      }),
    );
  }

  children.push(
    new Paragraph({
      spacing: { before: 100, after: 160 },
      children: [
        new TextRun({
          text: "СОДЕРЖАНИЕ РАСШИФРОВКИ",
          bold: true,
          size: 26,
          font: "Times New Roman",
          color: NAVY,
        }),
      ],
    }),
  );

  for (const segment of segments) {
    const headerRuns: TextRun[] = [];
    if (includeTimecodes) {
      headerRuns.push(
        new TextRun({
          text: `[${formatTime(segment.startTime)} – ${formatTime(segment.endTime)}] `,
          size: 20,
          color: GRAY,
          font: "Times New Roman",
        }),
      );
    }
    headerRuns.push(
      new TextRun({
        text: segment.speaker,
        bold: true,
        size: 22,
        font: "Times New Roman",
        color: NAVY,
      }),
    );
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 40 },
        children: headerRuns,
      }),
    );
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 720 },
        children: [
          new TextRun({
            text: normalizeSegmentText(segment.text),
            size: 22,
            font: "Times New Roman",
          }),
        ],
      }),
    );
  }

  children.push(
    new Paragraph({
      spacing: { before: 300 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 1 },
      },
      children: [],
    }),
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100 },
      children: [
        new TextRun({
          text: "Сформировано в ПротоколЪ · " + date,
          size: 18,
          color: LIGHT_GRAY,
          font: "Times New Roman",
        }),
      ],
    }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, filename);
}
