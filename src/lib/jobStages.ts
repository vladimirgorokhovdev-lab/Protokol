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
    msg.includes("подготовка к расшифровке") ||
    msg.includes("отправк") ||
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
