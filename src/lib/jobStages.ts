export interface JobStage {
  key:
    | "upload"
    | "linkParse"
    | "audioFetch"
    | "download"
    | "transcribe"
    | "parse"
    | "done";
  label: string;
  percent: number;
}

export const JOB_STAGES: JobStage[] = [
  { key: "upload", label: "Загрузка", percent: 15 },
  { key: "linkParse", label: "Парсинг ссылки", percent: 22 },
  { key: "audioFetch", label: "Получение аудио", percent: 35 },
  { key: "download", label: "Скачивание", percent: 30 },
  { key: "transcribe", label: "Расшифровка", percent: 65 },
  { key: "parse", label: "Разбор ролей", percent: 90 },
  { key: "done", label: "Готово", percent: 100 },
];

/**
 * Determine the current stage from upload progress + status_message text.
 * Heuristic but matches the messages produced by the elevenlabs-transcribe edge function.
 */
export function detectJobStage(
  uploadProgress: number,
  statusMessage: string | null | undefined,
  status?: "pending" | "processing" | "done" | "error" | "cancelled" | string,
): JobStage {
  const doneStage = JOB_STAGES[JOB_STAGES.length - 1];
  if (status === "done") return doneStage;
  if (uploadProgress < 100)
    return {
      ...JOB_STAGES[0],
      percent: Math.max(2, Math.round(uploadProgress * 0.15)),
    };

  const msg = (statusMessage || "").toLowerCase();
  if (msg.includes("разбор ролей"))
    return JOB_STAGES.find((s) => s.key === "parse")!;
  if (
    msg.includes("создание задач") ||
    msg.includes("повторная попытк") ||
    msg.includes("подготовка к расшифровке") ||
    msg.includes("отправк") ||
    msg.includes("ожидание результата") ||
    msg.includes("elevenlabs") ||
    msg.includes("расшифров") ||
    msg.includes("получен ответ") ||
    msg.includes("чтение данных")
  )
    return JOB_STAGES.find((s) => s.key === "transcribe")!;
  if (msg.includes("получение аудио") || msg.includes("аудио получено"))
    return JOB_STAGES.find((s) => s.key === "audioFetch")!;
  if (msg.includes("парсинг ссылки"))
    return JOB_STAGES.find((s) => s.key === "linkParse")!;
  if (msg.includes("скачив"))
    return JOB_STAGES.find((s) => s.key === "download")!;
  if (msg.includes("готово")) return doneStage;
  return JOB_STAGES.find((s) => s.key === "download")!;
}

/** Оценка: облачный STT обычно заметно быстрее реального времени записи. */
const ESTIMATED_PROCESSING_RATIO = 0.11;

function estimateProcessingSeconds(mediaDurationSec: number): number {
  if (!mediaDurationSec || mediaDurationSec <= 0) return 8 * 60;
  return Math.min(45 * 60, Math.max(90, mediaDurationSec * ESTIMATED_PROCESSING_RATIO));
}

export interface JobProgressOptions {
  /** Длительность записи, сек (из метаданных файла). */
  mediaDurationSec?: number | null;
  /** Когда завершилась загрузка в Storage (Date.now). */
  uploadCompletedAtMs?: number | null;
  now?: number;
}

/**
 * Плавный процент для полоски: загрузка по байтам, дальше — по времени и длительности аудио
 * (ElevenLabs не отдаёт реальный %).
 */
export function computeDisplayPercent(
  uploadProgress: number,
  statusMessage: string | null | undefined,
  status?: string,
  opts?: JobProgressOptions,
): number {
  const now = opts?.now ?? Date.now();
  const msg = (statusMessage || "").toLowerCase();

  if (status === "done" || msg.includes("готово:")) return 100;
  if (uploadProgress < 100) {
    return Math.max(2, Math.round((uploadProgress / 100) * 18));
  }

  if (msg.includes("сохранение")) return 97;
  if (msg.includes("разбор ролей")) {
    const t0 = opts?.uploadCompletedAtMs;
    if (t0) {
      const elapsed = (now - t0) / 1000;
      return Math.min(99, 88 + Math.min(8, Math.floor(elapsed / 3)));
    }
    return 90;
  }
  if (msg.includes("получен ответ") || msg.includes("чтение данных")) return 87;
  if (msg.includes("ожидание результата") || msg.includes("elevenlabs")) {
    const t0 = opts?.uploadCompletedAtMs;
    if (t0) {
      const elapsed = (now - t0) / 1000;
      const durationSec = opts?.mediaDurationSec ?? 0;
      const estimatedSec = estimateProcessingSeconds(durationSec);
      const t = Math.min(1, elapsed / estimatedSec);
      return Math.min(92, Math.round(70 + t * 22));
    }
    return 75;
  }

  const t0 = opts?.uploadCompletedAtMs;
  const durationSec = opts?.mediaDurationSec ?? 0;
  if (t0) {
    const elapsedSec = (now - t0) / 1000;
    const estimatedSec = estimateProcessingSeconds(durationSec);
    const t = Math.min(1, elapsedSec / estimatedSec);
    const eased = 1 - Math.pow(1 - t, 0.82);
    return Math.min(86, Math.round(18 + eased * 68));
  }

  return detectJobStage(uploadProgress, statusMessage, status).percent;
}
