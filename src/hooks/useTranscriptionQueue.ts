import { useState, useCallback, useEffect, useRef } from "react";
import {
  transcribeAudio,
  waitForJob,
  QuotaExceededError,
} from "@/lib/transcriptionService";
import { supabase } from "@/integrations/supabase/client";
import {
  saveTranscription,
  updateSpeakerNames,
} from "@/lib/transcriptionStorage";
import { showTranscriptionDoneNotification } from "@/lib/notifications";
import { toast } from "sonner";
import type { TranscriptSegment } from "@/lib/transcript";

let quotaToastShown = false;
const showQuotaToast = (message: string) => {
  if (quotaToastShown) return;
  quotaToastShown = true;
  setTimeout(() => {
    quotaToastShown = false;
  }, 5000);
  toast.error(message, {
    description: "Оформите подписку, чтобы продолжить расшифровку.",
    action: {
      label: "Тарифы",
      onClick: () => {
        window.location.href = "/pricing";
      },
    },
  });
};

export type QueueItemStatus =
  | "pending"
  | "processing"
  | "done"
  | "error"
  | "cancelled";

export interface QueueItem {
  id: string;
  file: File;
  audioUrl: string;
  status: QueueItemStatus;
  statusMessage: string;
  segments: TranscriptSegment[] | null;
  speakerNames: Record<string, string>;
  error: string | null;
  uploadProgress: number;
  dbId: string | null;
}

export function useTranscriptionQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const filesRef = useRef<Map<string, File>>(new Map());
  const jobIdsRef = useRef<Map<string, string>>(new Map());

  const updateItem = useCallback((id: string, updates: Partial<QueueItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }, []);

  const processItem = useCallback(
    async (id: string, file: File, numSpeakers?: number) => {
      const controller = new AbortController();
      abortControllers.current.set(id, controller);

      updateItem(id, {
        status: "processing",
        statusMessage: "Загрузка в хранилище...",
        uploadProgress: 0,
      });

      try {
        const callbacks = {
          onStatus: (message: string) =>
            updateItem(id, { statusMessage: message }),
          onUploadProgress: (progress: number) => {
            updateItem(id, { uploadProgress: progress });
          },
          onJobCreated: (jobId: string) => {
            jobIdsRef.current.set(id, jobId);
          },
        };
        const { segments, audioPath } = await transcribeAudio(
          file,
          controller.signal,
          callbacks,
          numSpeakers ? { numSpeakers } : undefined,
        );

        if (segments.length === 0) {
          throw new Error("Сервис вернул пустую расшифровку");
        }

        updateItem(id, { statusMessage: "Сохранение в историю..." });
        const dbId = await saveTranscription(
          file.name,
          segments,
          {},
          audioPath,
        );

        const jobId = jobIdsRef.current.get(id);
        if (dbId && jobId) {
          await supabase
            .from("transcription_jobs")
            .update({ transcription_id: dbId })
            .eq("id", jobId);
        }

        updateItem(id, {
          status: "done",
          segments,
          dbId,
          statusMessage: `Готово: ${segments.length} фрагментов`,
        });

        showTranscriptionDoneNotification(file.name, segments.length);

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const lastEnd =
            segments.length > 0 ? segments[segments.length - 1].endTime : 0;
          const seconds = Math.max(0, Math.round(lastEnd));
          supabase
            .rpc("increment_transcription_usage", {
              p_user_id: user.id,
              p_seconds: seconds,
            })
            .then(({ error }) => {
              if (error) console.error("Usage increment error:", error);
            });
          supabase
            .from("user_events")
            .insert({
              user_id: user.id,
              event_type: "transcription_completed",
              metadata: {
                file_name: file.name,
                segments: segments.length,
                seconds,
              },
            })
            .then(({ error }) => {
              if (error) console.warn("event:", error.message);
            });
        }
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          updateItem(id, { status: "cancelled", statusMessage: "Отменено" });
          return;
        }

        if (error instanceof QuotaExceededError) {
          showQuotaToast(error.message);
          updateItem(id, {
            status: "error",
            error: error.message,
            statusMessage: "Лимит исчерпан",
          });
        } else {
          const message =
            error instanceof Error
              ? error.message
              : "Не удалось обработать файл";
          updateItem(id, {
            status: "error",
            error: message,
            statusMessage: "Ошибка",
          });
        }
      } finally {
        abortControllers.current.delete(id);
      }
    },
    [updateItem],
  );

  const addFiles = useCallback(
    (files: File[], numSpeakers?: number) => {
      const newItems: QueueItem[] = files.map((file) => {
        const id = crypto.randomUUID();
        filesRef.current.set(id, file);
        return {
          id,
          file,
          audioUrl: URL.createObjectURL(file),
          status: "pending" as const,
          statusMessage: "В очереди...",
          segments: null,
          speakerNames: {},
          error: null,
          uploadProgress: 0,
          dbId: null,
        };
      });

      setItems((prev) => [...prev, ...newItems]);

      for (const item of newItems) {
        processItem(item.id, item.file, numSpeakers);
      }
    },
    [processItem],
  );

  // Auto-recovery on mount: rescue jobs that finished on the server but were
  // never saved to history (e.g. user closed tab during save), and reattach
  // to in-progress jobs so refreshing the page doesn't lose progress.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data: jobs } = await supabase
        .from("transcription_jobs")
        .select(
          "id, file_name, audio_path, status, status_message, segments, error",
        )
        .eq("user_id", user.id)
        .in("status", ["done", "processing", "queued"])
        .is("transcription_id", null)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: true });

      if (cancelled || !jobs || jobs.length === 0) return;

      for (const job of jobs) {
        const localId = crypto.randomUUID();
        jobIdsRef.current.set(localId, job.id);

        const placeholder: QueueItem = {
          id: localId,
          file: new File([], job.file_name),
          audioUrl: "",
          status: "processing",
          statusMessage:
            job.status === "done"
              ? "Восстановление в историю..."
              : job.status_message || "Возобновление...",
          segments: null,
          speakerNames: {},
          error: null,
          uploadProgress: 100,
          dbId: null,
        };
        setItems((prev) => [...prev, placeholder]);

        if (job.status === "done" && job.segments) {
          try {
            const segs = job.segments as unknown as TranscriptSegment[];
            const dbId = await saveTranscription(
              job.file_name,
              segs,
              {},
              job.audio_path,
            );
            if (dbId) {
              await supabase
                .from("transcription_jobs")
                .update({ transcription_id: dbId })
                .eq("id", job.id);
              updateItem(localId, {
                status: "done",
                segments: segs,
                dbId,
                statusMessage: `Восстановлено: ${segs.length} фрагментов`,
              });
            } else {
              updateItem(localId, {
                status: "error",
                error: "Не удалось восстановить расшифровку",
                statusMessage: "Ошибка восстановления",
              });
            }
          } catch (err) {
            updateItem(localId, {
              status: "error",
              error:
                err instanceof Error ? err.message : "Ошибка восстановления",
              statusMessage: "Ошибка восстановления",
            });
          }
        } else {
          const controller = new AbortController();
          abortControllers.current.set(localId, controller);
          waitForJob(job.id, controller.signal, {
            onStatus: (msg) => updateItem(localId, { statusMessage: msg }),
          })
            .then(async (segs) => {
              updateItem(localId, { statusMessage: "Сохранение в историю..." });
              const dbId = await saveTranscription(
                job.file_name,
                segs,
                {},
                job.audio_path,
              );
              if (dbId) {
                await supabase
                  .from("transcription_jobs")
                  .update({ transcription_id: dbId })
                  .eq("id", job.id);
              }
              updateItem(localId, {
                status: "done",
                segments: segs,
                dbId,
                statusMessage: `Готово: ${segs.length} фрагментов`,
              });
              showTranscriptionDoneNotification(job.file_name, segs.length);
            })
            .catch((err) => {
              if (controller.signal.aborted) return;
              updateItem(localId, {
                status: "error",
                error: err instanceof Error ? err.message : "Ошибка",
                statusMessage: "Ошибка",
              });
            })
            .finally(() => {
              abortControllers.current.delete(localId);
            });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelItem = useCallback((id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) controller.abort();

    // Tell the edge function to stop by writing cancelled status to the job row.
    const jobId = jobIdsRef.current.get(id);
    if (jobId) {
      supabase
        .from("transcription_jobs")
        .update({
          status: "cancelled",
          status_message: "Отменено пользователем",
        })
        .eq("id", jobId)
        .then(({ error }) => {
          if (error) console.error("Failed to mark job cancelled:", error);
        });
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) controller.abort();

    const jobId = jobIdsRef.current.get(id);
    if (jobId) {
      supabase
        .from("transcription_jobs")
        .update({
          status: "cancelled",
          status_message: "Отменено пользователем",
        })
        .eq("id", jobId)
        .then(({ error }) => {
          if (error)
            console.error("Failed to mark job cancelled on remove:", error);
        });
      jobIdsRef.current.delete(id);
    }

    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.audioUrl);
      return prev.filter((i) => i.id !== id);
    });

    filesRef.current.delete(id);
    abortControllers.current.delete(id);
  }, []);

  const retryItem = useCallback(
    (id: string) => {
      const file = filesRef.current.get(id);
      if (!file) return;

      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: "pending" as const,
                error: null,
                statusMessage: "В очереди...",
              }
            : i,
        ),
      );

      processItem(id, file);
    },
    [items, processItem],
  );

  const renameSpeaker = useCallback(
    (itemId: string, originalName: string, newName: string) => {
      setItems((prev) => {
        const item = prev.find((i) => i.id === itemId);
        if (!item) return prev;

        const updatedNames = { ...item.speakerNames, [originalName]: newName };

        // Persist to DB if saved
        if (item.dbId) {
          updateSpeakerNames(item.dbId, updatedNames).catch(console.error);
        }

        return prev.map((i) =>
          i.id === itemId ? { ...i, speakerNames: updatedNames } : i,
        );
      });
    },
    [],
  );

  return { items, addFiles, cancelItem, removeItem, retryItem, renameSpeaker };
}
