import type { TranscriptSegment } from "@/lib/transcript";

export type TemplateType = "court" | "negotiation" | "meeting";

export interface ExportTemplate {
  id: TemplateType;
  name: string;
  description: string;
  title: string;
  buildHeader: (meta: ExportMeta) => string[];
}

export interface ExportMeta {
  date: string;
  speakers: string[];
  duration: string;
  segmentCount: number;
  fileName?: string;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export function buildMeta(segments: TranscriptSegment[], fileName?: string): ExportMeta {
  const uniqueSpeakers = [...new Set(segments.map((s) => s.speaker))];
  const totalDuration = segments.length > 0 ? segments[segments.length - 1].endTime : 0;
  return {
    date: new Date().toLocaleDateString("ru-RU"),
    speakers: uniqueSpeakers,
    duration: formatTime(totalDuration),
    segmentCount: segments.length,
    fileName,
  };
}

export const templates: ExportTemplate[] = [
  {
    id: "court",
    name: "Судебное заседание",
    description: "Официальный протокол судебного заседания",
    title: "ПРОТОКОЛ СУДЕБНОГО ЗАСЕДАНИЯ",
    buildHeader: (meta) => [
      `Дата заседания: ${meta.date}`,
      `Участники процесса: ${meta.speakers.join(", ")}`,
      `Длительность записи: ${meta.duration}`,
      `Количество фрагментов: ${meta.segmentCount}`,
    ],
  },
  {
    id: "negotiation",
    name: "Переговоры",
    description: "Протокол деловых переговоров",
    title: "ПРОТОКОЛ ПЕРЕГОВОРОВ",
    buildHeader: (meta) => [
      `Дата проведения: ${meta.date}`,
      `Стороны переговоров: ${meta.speakers.join(", ")}`,
      `Продолжительность: ${meta.duration}`,
    ],
  },
  {
    id: "meeting",
    name: "Совещание",
    description: "Протокол рабочего совещания",
    title: "ПРОТОКОЛ СОВЕЩАНИЯ",
    buildHeader: (meta) => [
      `Дата: ${meta.date}`,
      `Присутствовали: ${meta.speakers.join(", ")}`,
      `Длительность: ${meta.duration}`,
      `Зафиксировано высказываний: ${meta.segmentCount}`,
    ],
  },
];

export function getTemplate(id: TemplateType): ExportTemplate {
  return templates.find((t) => t.id === id) || templates[0];
}
