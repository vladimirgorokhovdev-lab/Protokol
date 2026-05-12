import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeadersForRequest, handleCorsPreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface Body {
  transcription_id: string;
}

function extOf(path: string): string {
  const m = path.split("?")[0].split(".").pop() || "";
  return m.toLowerCase();
}

function mimeFor(ext: string): string {
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    wav: "audio/wav",
    ogg: "audio/ogg",
    webm: "audio/webm",
    aac: "audio/aac",
    flac: "audio/flac",
  };
  return map[ext] || "application/octet-stream";
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  const corsHeaders = corsHeadersForRequest(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = (await req.json()) as Body;
    if (!body?.transcription_id || typeof body.transcription_id !== "string") {
      return new Response(
        JSON.stringify({ error: "transcription_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tr, error: trErr } = await admin
      .from("transcriptions")
      .select("id, user_id, file_name, source_audio_paths, audio_path")
      .eq("id", body.transcription_id)
      .maybeSingle();

    if (trErr || !tr) {
      return new Response(
        JSON.stringify({ error: "Transcription not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (tr.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourcePaths = (tr.source_audio_paths || []) as string[];
    const validPaths = sourcePaths.filter(
      (p) => typeof p === "string" && p.length > 0,
    );
    if (validPaths.length < 2) {
      return new Response(
        JSON.stringify({
          error:
            "Недостаточно исходных аудиофайлов для объединения (нужно минимум 2).",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const exts = validPaths.map(extOf);
    const firstExt = exts[0];
    if (!exts.every((e) => e === firstExt)) {
      return new Response(
        JSON.stringify({
          error: `Формат файлов различается (${[...new Set(exts)].join(", ")}). Простая склейка возможна только при одинаковом формате (например, все MP3).`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const missing: string[] = [];
    const presentPaths: string[] = [];
    for (const path of validPaths) {
      const { data: signed, error: signErr } = await admin.storage
        .from("audio-files")
        .createSignedUrl(path, 60);
      if (signErr || !signed?.signedUrl) {
        console.warn(`merge-audio: missing source ${path}`, signErr?.message);
        missing.push(path);
        continue;
      }
      presentPaths.push(path);
    }

    if (presentPaths.length < 2) {
      return new Response(
        JSON.stringify({
          error:
            `Недостаточно доступных аудиофайлов для объединения. Отсутствуют в хранилище: ${missing.join(", ") || "—"}. ` +
            `Возможно, исходные файлы были удалены ранее.`,
          missing,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const parts: BlobPart[] = [];
    let totalSize = 0;
    for (const path of presentPaths) {
      const { data, error } = await admin.storage
        .from("audio-files")
        .download(path);
      if (error || !data) {
        console.warn(`merge-audio: download failed ${path}`, error?.message);
        missing.push(path);
        continue;
      }
      parts.push(data);
      totalSize += data.size;
    }

    if (parts.length < 2) {
      return new Response(
        JSON.stringify({
          error: `Не удалось скачать достаточное число исходников. Отсутствуют: ${missing.join(", ") || "—"}.`,
          missing,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const mergedBlob = new Blob(parts, { type: mimeFor(firstExt) });

    const newPath = `${userId}/${crypto.randomUUID()}-merged.${firstExt}`;
    const { error: upErr } = await admin.storage
      .from("audio-files")
      .upload(newPath, mergedBlob, {
        contentType: mimeFor(firstExt),
        upsert: false,
      });

    if (upErr) {
      return new Response(
        JSON.stringify({ error: `Ошибка загрузки: ${upErr.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (tr.audio_path) {
      await admin.storage.from("audio-files").remove([tr.audio_path]);
    }

    const { error: updErr } = await admin
      .from("transcriptions")
      .update({ audio_path: newPath })
      .eq("id", tr.id);

    if (updErr) {
      return new Response(
        JSON.stringify({ error: `Ошибка сохранения: ${updErr.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        audio_path: newPath,
        size: totalSize,
        parts: validPaths.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("merge-audio error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
