import { supabase } from "@/integrations/supabase/client";
import { uploadAudioFile } from "@/lib/transcriptionStorage";
import type { TranscriptSegment } from "./transcript";

export class QuotaExceededError extends Error {
  constructor(message = "Лимит расшифровок по вашему тарифу исчерпан") {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export interface TranscriptionCallbacks {
  onStatus?: (message: string) => void;
  onUploadProgress?: (progress: number) => void;
  onJobCreated?: (jobId: string) => void;
}

export interface TranscribeResult {
  segments: TranscriptSegment[];
  audioPath: string;
}

/**
 * New flow:
 *  1. Upload file directly to Supabase Storage (no Edge Function memory pressure).
 *  2. Call edge function with { audio_path, file_name } — it creates a job row
 *     and processes in background via EdgeRuntime.waitUntil.
 *  3. Subscribe to realtime updates on transcription_jobs (with polling fallback).
 */
export async function transcribeAudio(
  file: File,
  signal: AbortSignal,
  callbacks?: TranscriptionCallbacks,
  options?: { numSpeakers?: number },
): Promise<TranscribeResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Требуется авторизация");

  callbacks?.onStatus?.("Загрузка в хранилище...");
  callbacks?.onUploadProgress?.(0);

  const audioPath = await uploadAudioFile(file, user.id, (pct) => {
    callbacks?.onUploadProgress?.(pct);
    if (pct < 100) callbacks?.onStatus?.(`Загрузка: ${pct}%`);
  });

  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (!audioPath) throw new Error("Не удалось загрузить файл в хранилище");

  callbacks?.onUploadProgress?.(100);
  callbacks?.onStatus?.("Создание задачи...");

  const invokeBody = {
    audio_path: audioPath,
    file_name: file.name,
    num_speakers: options?.numSpeakers,
  };

  let invokeData: unknown = null;
  let invokeErr: { message?: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const res = await supabase.functions.invoke("elevenlabs-transcribe", {
      body: invokeBody,
    });
    invokeData = res.data;
    invokeErr = res.error;

    if (invokeErr) {
      const ctx = (invokeErr as { context?: Response }).context;
      if (
        ctx &&
        typeof ctx === "object" &&
        "status" in ctx &&
        (ctx as Response).status === 402
      ) {
        let body: { message?: string; error?: string } = {};
        try {
          body = await (ctx as Response).clone().json();
        } catch {
          /* ignore */
        }
        throw new QuotaExceededError(
          body.message || "Лимит расшифровок исчерпан",
        );
      }
    }

    if (!invokeErr) break;
    if (attempt < 2) {
      callbacks?.onStatus?.(`Повторная попытка (${attempt + 2}/3)...`);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  if (invokeErr)
    throw new Error(invokeErr.message || "Не удалось запустить расшифровку");
  const jobId = (invokeData as { job_id?: string })?.job_id;
  if (!jobId) throw new Error("Сервер не вернул идентификатор задачи");

  callbacks?.onJobCreated?.(jobId);
  callbacks?.onStatus?.("Расшифровка...");

  const segments = await waitForJob(jobId, signal, callbacks);
  return { segments, audioPath };
}

export async function waitForJob(
  jobId: string,
  signal: AbortSignal,
  callbacks?: TranscriptionCallbacks,
): Promise<TranscriptSegment[]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer: number | undefined;

    const cleanup = () => {
      if (pollTimer) window.clearInterval(pollTimer);
      supabase.removeChannel(channel);
      signal.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const handleRow = (row: {
      status: string;
      status_message?: string | null;
      segments?: unknown;
      error?: string | null;
    }) => {
      if (settled) return;
      if (row.status_message) callbacks?.onStatus?.(row.status_message);

      if (row.status === "done" && row.segments) {
        settled = true;
        cleanup();
        resolve(row.segments as TranscriptSegment[]);
      } else if (row.status === "error") {
        settled = true;
        cleanup();
        reject(new Error(row.error || "Ошибка расшифровки"));
      } else if (row.status === "cancelled") {
        settled = true;
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
      }
    };

    signal.addEventListener("abort", onAbort);

    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transcription_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => handleRow(payload.new as Parameters<typeof handleRow>[0]),
      )
      .subscribe();

    const poll = async () => {
      if (settled) return;
      const { data, error } = await supabase
        .from("transcription_jobs")
        .select("status, status_message, segments, error")
        .eq("id", jobId)
        .maybeSingle();
      if (error || !data) return;
      handleRow(data as Parameters<typeof handleRow>[0]);
    };

    poll();
    pollTimer = window.setInterval(poll, 4000);
  });
}
