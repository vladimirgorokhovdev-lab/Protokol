import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { corsHeadersForRequest, handleCorsPreflight } from "../_shared/cors.ts";
import {
  buildElevenLabsForm,
  convertToSegments,
  formatSizeMbFromUrl,
  type ElevenLabsTranscription,
} from "../_shared/elevenlabsTranscript.ts";

function jsonResponse(
  status: number,
  body: unknown,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isWebhookAck(data: Record<string, unknown>): boolean {
  return (
    typeof data.request_id === "string" ||
    typeof data.transcription_id === "string" ||
    (typeof data.message === "string" &&
      !Array.isArray((data as ElevenLabsTranscription).words))
  );
}

function hasSyncTranscript(data: ElevenLabsTranscription): boolean {
  return Boolean(
    (data.words && data.words.length > 0) ||
      (data.text && data.text.length > 0),
  );
}

async function processJob(
  admin: ReturnType<typeof createClient>,
  jobId: string,
  audioPath: string,
  numSpeakers: number | null,
  apiKey: string,
) {
  const updateJob = async (patch: Record<string, unknown>) => {
    await admin.from("transcription_jobs").update(patch).eq("id", jobId);
  };

  const isCancelled = async (): Promise<boolean> => {
    const { data } = await admin
      .from("transcription_jobs")
      .select("status")
      .eq("id", jobId)
      .maybeSingle();
    return data?.status === "cancelled";
  };

  class CancelledError extends Error {
    constructor() {
      super("cancelled");
      this.name = "CancelledError";
    }
  }
  const checkpoint = async () => {
    if (await isCancelled()) throw new CancelledError();
  };

  const touchJob = async (message: string) => {
    await updateJob({ status_message: message });
  };

  try {
    await checkpoint();
    await touchJob(
      /^https?:\/\//i.test(audioPath)
        ? "Парсинг ссылки..."
        : "Подготовка файла...",
    );
    await updateJob({ status: "processing" });

    let cloudStorageUrl: string;
    if (/^https?:\/\//i.test(audioPath)) {
      cloudStorageUrl = audioPath;
    } else {
      const signed = await admin.storage
        .from("audio-files")
        .createSignedUrl(audioPath, 3600);
      if (!signed.data?.signedUrl) {
        throw new Error("Не удалось получить ссылку на файл");
      }
      cloudStorageUrl = signed.data.signedUrl;
    }
    await checkpoint();

    const sizeMb = await formatSizeMbFromUrl(cloudStorageUrl);
    console.log(
      `[job ${jobId}] ElevenLabs async webhook (${sizeMb} MB, cloud_storage_url)`,
    );
    await touchJob(`Отправка в ElevenLabs (${sizeMb} МБ)...`);

    const SUBMIT_TIMEOUT_MS = 2 * 60 * 1000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
    const cancelPoll = setInterval(async () => {
      if (await isCancelled()) controller.abort();
    }, 5000);

    const form = buildElevenLabsForm(cloudStorageUrl, numSpeakers, jobId);

    let response: Response;
    try {
      response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: form,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        if (await isCancelled()) throw new CancelledError();
        throw new Error(
          "Таймаут при отправке в ElevenLabs. Повторите позже.",
        );
      }
      throw new Error(`Сетевая ошибка ElevenLabs: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeoutId);
      clearInterval(cancelPoll);
    }

    console.log(`[job ${jobId}] ElevenLabs submit responded ${response.status}`);
    await checkpoint();

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      throw new Error(
        `Ошибка API ElevenLabs (${response.status}): ${errorText.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as ElevenLabsTranscription &
      Record<string, unknown>;

    if (hasSyncTranscript(payload)) {
      await touchJob("Разбор ролей...");
      const segments = convertToSegments(payload, numSpeakers);
      if (segments.length === 0) throw new Error("Пустая расшифровка");

      const { data: finalCheck } = await admin
        .from("transcription_jobs")
        .update({
          status: "done",
          status_message: `Готово: ${segments.length} фрагментов`,
          segments,
          error: null,
        })
        .eq("id", jobId)
        .neq("status", "cancelled")
        .select("id")
        .maybeSingle();

      if (!finalCheck) {
        console.log(`[job ${jobId}] cancelled before sync final write`);
      }
      return;
    }

    if (isWebhookAck(payload)) {
      const requestId = payload.request_id ?? "unknown";
      console.log(`[job ${jobId}] webhook accepted, request_id=${requestId}`);
      await updateJob({
        status: "processing",
        status_message: "Ожидание результата от ElevenLabs…",
        error: null,
      });
      return;
    }

    throw new Error("Неожиданный ответ ElevenLabs (нет request_id и нет текста)");
  } catch (error) {
    if (
      error instanceof CancelledError ||
      (error as Error)?.name === "CancelledError"
    ) {
      console.log(`[job ${jobId}] cancelled by user`);
      await admin
        .from("transcription_jobs")
        .update({
          status: "cancelled",
          status_message: "Отменено пользователем",
        })
        .eq("id", jobId);
      return;
    }
    console.error("Job failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    await admin
      .from("transcription_jobs")
      .update({ status: "error", error: message, status_message: "Ошибка" })
      .eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  const corsHeaders = corsHeadersForRequest(req);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

  if (!ELEVENLABS_API_KEY) {
    return jsonResponse(
      500,
      { error: "ElevenLabs API key not configured" },
      corsHeaders,
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader)
    return jsonResponse(401, { error: "Missing authorization" }, corsHeaders);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();
  if (authErr || !user)
    return jsonResponse(401, { error: "Unauthorized" }, corsHeaders);

  let payload: {
    audio_path?: string;
    file_name?: string;
    num_speakers?: number;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" }, corsHeaders);
  }

  const audioPath = payload.audio_path;
  const fileName = payload.file_name;
  if (!audioPath || !fileName) {
    return jsonResponse(
      400,
      { error: "audio_path and file_name are required" },
      corsHeaders,
    );
  }
  if (!audioPath.startsWith(`${user.id}/`)) {
    return jsonResponse(403, { error: "Forbidden audio path" }, corsHeaders);
  }

  const numSpeakers =
    typeof payload.num_speakers === "number" &&
    payload.num_speakers >= 1 &&
    payload.num_speakers <= 32
      ? payload.num_speakers
      : null;

  const { data: allowed, error: quotaErr } = await userClient.rpc(
    "can_user_transcribe",
    {
      p_user_id: user.id,
    },
  );
  if (quotaErr) {
    console.error("Quota check failed:", quotaErr);
    return jsonResponse(500, { error: "Quota check failed" }, corsHeaders);
  }
  if (!allowed) {
    return jsonResponse(
      402,
      {
        error: "quota_exceeded",
        message:
          "Лимит расшифровок по вашему тарифу исчерпан. Оформите подписку.",
      },
      corsHeaders,
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: job, error: jobErr } = await admin
    .from("transcription_jobs")
    .insert({
      user_id: user.id,
      audio_path: audioPath,
      file_name: fileName,
      num_speakers: numSpeakers,
      status: "queued",
      status_message: "В очереди...",
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    console.error("Failed to create job:", jobErr);
    return jsonResponse(500, { error: "Failed to create job" }, corsHeaders);
  }

  EdgeRuntime.waitUntil(
    processJob(admin, job.id, audioPath, numSpeakers, ELEVENLABS_API_KEY),
  );

  return jsonResponse(200, { job_id: job.id }, corsHeaders);
});
