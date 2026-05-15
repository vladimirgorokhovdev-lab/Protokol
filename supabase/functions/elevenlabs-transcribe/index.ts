import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { corsHeadersForRequest, handleCorsPreflight } from "../_shared/cors.ts";

interface TranscriptSegment {
  id: string;
  speaker: string;
  speakerIndex: number;
  text: string;
  startTime: number;
  endTime: number;
}

interface ElevenLabsWord {
  text: string;
  start: number;
  end: number;
  speaker?: string;
  speaker_id?: string;
}

interface ElevenLabsTranscription {
  text?: string;
  words?: ElevenLabsWord[];
}

function formatSpeakerName(speaker: string, index: number): string {
  if (speaker === "unknown") return `Спикер ${index + 1}`;
  if (speaker.startsWith("speaker_")) {
    return `Спикер ${Number.parseInt(speaker.split("_")[1], 10) + 1}`;
  }
  return speaker;
}

function convertToSegments(
  data: ElevenLabsTranscription,
  maxSpeakers: number | null = null,
): TranscriptSegment[] {
  if (!data.words || data.words.length === 0) {
    return [
      {
        id: "1",
        speaker: "Спикер",
        speakerIndex: 0,
        text: data.text ?? "",
        startTime: 0,
        endTime: 0,
      },
    ];
  }

  const speakerRemap = new Map<string, string>();
  if (maxSpeakers && maxSpeakers >= 1) {
    const durations = new Map<string, number>();
    for (const w of data.words) {
      const sp = w.speaker_id ?? w.speaker ?? "unknown";
      durations.set(
        sp,
        (durations.get(sp) ?? 0) + Math.max(0, (w.end ?? 0) - (w.start ?? 0)),
      );
    }
    const sorted = [...durations.entries()].sort((a, b) => b[1] - a[1]);
    const keep = new Set(sorted.slice(0, maxSpeakers).map(([sp]) => sp));
    if (sorted.length > maxSpeakers) {
      const keepWords = data.words.filter((w) =>
        keep.has(w.speaker_id ?? w.speaker ?? "unknown"),
      );
      for (const [sp] of sorted.slice(maxSpeakers)) {
        const myWords = data.words.filter(
          (w) => (w.speaker_id ?? w.speaker ?? "unknown") === sp,
        );
        if (myWords.length === 0) continue;
        const myMid = (myWords[0].start + myWords[myWords.length - 1].end) / 2;
        let bestSp = sorted[0][0];
        let bestDist = Infinity;
        for (const w of keepWords) {
          const wMid = (w.start + w.end) / 2;
          const d = Math.abs(wMid - myMid);
          if (d < bestDist) {
            bestDist = d;
            bestSp = w.speaker_id ?? w.speaker ?? "unknown";
          }
        }
        speakerRemap.set(sp, bestSp);
      }
    }
  }

  const resolveSpeaker = (raw: string): string => speakerRemap.get(raw) ?? raw;

  const segments: TranscriptSegment[] = [];
  const speakerMap = new Map<string, number>();
  let currentSpeaker = resolveSpeaker(
    data.words[0].speaker_id ?? data.words[0].speaker ?? "unknown",
  );
  let currentWords: string[] = [data.words[0].text];
  let startTime = data.words[0].start;
  let endTime = data.words[0].end;

  if (!speakerMap.has(currentSpeaker)) {
    speakerMap.set(currentSpeaker, speakerMap.size);
  }

  for (let i = 1; i < data.words.length; i++) {
    const word = data.words[i];
    const speaker = resolveSpeaker(
      word.speaker_id ?? word.speaker ?? "unknown",
    );

    if (speaker !== currentSpeaker) {
      segments.push({
        id: String(segments.length + 1),
        speaker: formatSpeakerName(
          currentSpeaker,
          speakerMap.get(currentSpeaker) ?? 0,
        ),
        speakerIndex: speakerMap.get(currentSpeaker) ?? 0,
        text: currentWords.join(" ").trim(),
        startTime,
        endTime,
      });
      currentSpeaker = speaker;
      if (!speakerMap.has(speaker)) speakerMap.set(speaker, speakerMap.size);
      currentWords = [word.text];
      startTime = word.start;
      endTime = word.end;
      continue;
    }

    currentWords.push(word.text);
    endTime = word.end;
  }

  segments.push({
    id: String(segments.length + 1),
    speaker: formatSpeakerName(
      currentSpeaker,
      speakerMap.get(currentSpeaker) ?? 0,
    ),
    speakerIndex: speakerMap.get(currentSpeaker) ?? 0,
    text: currentWords.join(" ").trim(),
    startTime,
    endTime,
  });

  return segments;
}

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

  let lastStatusMessage = "Обработка...";
  const touchJob = async (message: string) => {
    lastStatusMessage = message;
    await updateJob({ status_message: message });
  };

  const HEARTBEAT_MS = 45 * 1000;
  const heartbeat = setInterval(async () => {
    try {
      if (await isCancelled()) return;
      await updateJob({ status_message: lastStatusMessage });
    } catch (e) {
      console.warn(`[job ${jobId}] heartbeat:`, e);
    }
  }, HEARTBEAT_MS);

  try {
    await checkpoint();
    await touchJob(
      /^https?:\/\//i.test(audioPath)
        ? "Парсинг ссылки..."
        : "Подготовка файла...",
    );
    await updateJob({ status: "processing" });

    const signedUrl = (
      await admin.storage.from("audio-files").createSignedUrl(audioPath, 3600)
    ).data?.signedUrl;
    if (!signedUrl) throw new Error("Не удалось получить ссылку на файл");
    await checkpoint();

    const audioRes = await fetch(signedUrl);
    if (audioRes && (!audioRes.ok || !audioRes.body)) {
      throw new Error(`Не удалось открыть файл (${audioRes.status})`);
    }
    const contentLength = audioRes?.headers.get("content-length");
    const sizeMb = contentLength
      ? (Number(contentLength) / 1024 / 1024).toFixed(2)
      : "?";
    console.log(`[job ${jobId}] streaming ${sizeMb} MB to ElevenLabs`);
    await touchJob(`Расшифровка (${sizeMb} МБ)...`);

    const FETCH_TIMEOUT_MS = 45 * 60 * 1000;

    const fileName = audioPath.split("/").pop() || "audio";
    const boundary = `----LexScribeBoundary${crypto.randomUUID().replace(/-/g, "")}`;
    const enc = new TextEncoder();
    const fields: Array<[string, string]> = [
      ["model_id", "scribe_v2"],
      ["diarize", "true"],
      ["tag_audio_events", "true"],
      ["language_code", "rus"],
    ];
    if (numSpeakers) fields.push(["num_speakers", String(numSpeakers)]);

    const buildFieldPart = (name: string, value: string) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
    const fileHeader =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`;
    const closing = `\r\n--${boundary}--\r\n`;

    const audioReader = audioRes.body!.getReader();

    const readNextMediaChunk = async (): Promise<Uint8Array | null> => {
      const { done, value } = await audioReader.read();
      return done ? null : value;
    };
    const multipartStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const [k, v] of fields)
          controller.enqueue(enc.encode(buildFieldPart(k, v)));
        controller.enqueue(enc.encode(fileHeader));
      },
      async pull(controller) {
        const value = await readNextMediaChunk();
        if (!value) {
          controller.enqueue(enc.encode(closing));
          controller.close();
          return;
        }
        controller.enqueue(value);
      },
      cancel() {
        audioReader?.cancel().catch(() => {});
      },
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const cancelPoll = setInterval(async () => {
      if (await isCancelled()) controller.abort();
    }, 5000);

    let response: Response;
    try {
      response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: multipartStream,
        signal: controller.signal,
        // @ts-ignore
        duplex: "half",
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        if (await isCancelled()) throw new CancelledError();
        throw new Error(
          `Таймаут запроса к ElevenLabs (${Math.round(FETCH_TIMEOUT_MS / 60000)} мин). Файл очень длинный — разбейте на части или сожмите MP3.`,
        );
      }
      throw new Error(`Сетевая ошибка ElevenLabs: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeoutId);
      clearInterval(cancelPoll);
    }

    console.log(`[job ${jobId}] ElevenLabs responded with ${response.status}`);
    await checkpoint();
    await touchJob("Получен ответ, чтение данных...");

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      throw new Error(
        `Ошибка API ElevenLabs (${response.status}): ${errorText.slice(0, 200)}`,
      );
    }

    const transcription = (await response.json()) as ElevenLabsTranscription;
    await checkpoint();
    const wordCount = transcription.words?.length ?? 0;
    await touchJob(`Разбор ролей (${wordCount} слов)...`);

    const segments = convertToSegments(transcription, numSpeakers);

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
      console.log(
        `[job ${jobId}] cancelled before final write — skipping done state`,
      );
    }
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
  } finally {
    clearInterval(heartbeat);
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
