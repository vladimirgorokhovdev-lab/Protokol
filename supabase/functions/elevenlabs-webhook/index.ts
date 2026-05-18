import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { billJobUsage } from "../_shared/billJobUsage.ts";
import {
  convertToSegments,
  type ElevenLabsTranscription,
  type WebhookJobMetadata,
} from "../_shared/elevenlabsTranscript.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type WebhookPayload = {
  type?: string;
  data?: {
    request_id?: string;
    webhook_metadata?: WebhookJobMetadata | string;
    transcription?: ElevenLabsTranscription;
    status?: string;
    error?: string;
    message?: string;
  };
  transcription?: ElevenLabsTranscription;
};

function parseMetadata(
  raw: WebhookJobMetadata | string | undefined,
): WebhookJobMetadata | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as WebhookJobMetadata;
    } catch {
      return null;
    }
  }
  return raw;
}

function extractTranscription(body: WebhookPayload): ElevenLabsTranscription | null {
  if (body.data?.transcription) return body.data.transcription;
  if (body.transcription) return body.transcription;
  return null;
}

function isFailure(body: WebhookPayload): boolean {
  const status = body.data?.status?.toLowerCase();
  if (status === "failed" || status === "error") return true;
  const t = body.type?.toLowerCase() ?? "";
  return t.includes("failed") || t.includes("error");
}

const jsonHeaders = { "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  let body: WebhookPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const metadata = parseMetadata(body.data?.webhook_metadata);
  const jobId = metadata?.job_id;

  if (!jobId) {
    console.error("[elevenlabs-webhook] missing job_id in webhook_metadata", body);
    return new Response(JSON.stringify({ error: "Missing job_id" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (isFailure(body)) {
    const msg =
      body.data?.error ??
      body.data?.message ??
      "Ошибка расшифровки ElevenLabs";
    console.error(`[elevenlabs-webhook] job ${jobId} failed:`, msg);
    await supabase
      .from("transcription_jobs")
      .update({
        status: "error",
        error: msg,
        status_message: "Ошибка",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  }

  const transcription = extractTranscription(body);
  if (!transcription) {
    console.error(`[elevenlabs-webhook] job ${jobId}: no transcription in payload`, body);
    return new Response(JSON.stringify({ error: "No transcription data" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const segments = convertToSegments(
    transcription,
    metadata?.num_speakers ?? null,
  );

  const { error } = await supabase
    .from("transcription_jobs")
    .update({
      status: "done",
      status_message: `Готово: ${segments.length} фрагментов`,
      segments,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .neq("status", "cancelled");

  if (error) {
    console.error(`[elevenlabs-webhook] job ${jobId} DB update failed:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  console.log(
    `[elevenlabs-webhook] job ${jobId} done, ${segments.length} segments`,
  );

  await billJobUsage(supabase, jobId);

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: jsonHeaders,
  });
});
