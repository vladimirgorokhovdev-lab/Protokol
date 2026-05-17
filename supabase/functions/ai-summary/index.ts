import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeadersForRequest, handleCorsPreflight } from "../_shared/cors.ts";

type SegmentInput = {
  speaker: string;
  text: string;
  startTime: number;
};

/** ~90k chars — safe for gpt-4o-mini context with tool output. */
const MAX_TRANSCRIPT_CHARS = 90_000;

function json(
  status: number,
  body: unknown,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function segmentLine(
  s: SegmentInput,
  speakerNames?: Record<string, string>,
): string {
  const speaker = speakerNames?.[s.speaker] || s.speaker;
  return `[${formatTime(s.startTime)}] ${speaker}: ${s.text}`;
}

/** Long hearings: sample head, tail, and evenly spaced middle. */
function buildTranscriptForSummary(
  segments: SegmentInput[],
  speakerNames?: Record<string, string>,
): { text: string; truncated: boolean } {
  const lines = segments.map((s) => segmentLine(s, speakerNames));
  const full = lines.join("\n");
  if (full.length <= MAX_TRANSCRIPT_CHARS) {
    return { text: full, truncated: false };
  }

  const head = Math.min(120, segments.length);
  const tail = Math.min(120, segments.length);
  const picked = new Set<number>();
  for (let i = 0; i < head; i++) picked.add(i);
  for (let i = Math.max(head, segments.length - tail); i < segments.length; i++) {
    picked.add(i);
  }

  const midStart = head;
  const midEnd = Math.max(midStart, segments.length - tail);
  const midSlots = 250;
  const step = Math.max(1, Math.ceil((midEnd - midStart) / midSlots));
  for (let i = midStart; i < midEnd; i += step) picked.add(i);

  const ordered = [...picked].sort((a, b) => a - b);
  const out: string[] = [
    `[Для анализа использована сокращённая выборка из ${segments.length} фрагментов полной расшифровки.]`,
    "",
  ];
  let prev = -1;
  for (const idx of ordered) {
    if (prev >= 0 && idx > prev + 1) {
      out.push("[...]");
    }
    out.push(segmentLine(segments[idx], speakerNames));
    prev = idx;
    if (out.join("\n").length >= MAX_TRANSCRIPT_CHARS) break;
  }

  let text = out.join("\n");
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    text = text.slice(0, MAX_TRANSCRIPT_CHARS);
  }
  return { text, truncated: true };
}

serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  const corsHeaders = corsHeadersForRequest(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(401, { error: "Не авторизован" }, corsHeaders);
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return json(401, { error: "Не авторизован" }, corsHeaders);
    }

    const { segments, speakerNames } = await req.json();

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return json(400, { error: "Нет текста для анализа" }, corsHeaders);
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return json(
        503,
        {
          error:
            "AI-резюме не настроено: добавьте OPENAI_API_KEY в Supabase → Edge Functions → Secrets",
        },
        corsHeaders,
      );
    }

    const model = Deno.env.get("OPENAI_SUMMARY_MODEL")?.trim() || "gpt-4o-mini";
    const apiBase = (
      Deno.env.get("OPENAI_API_BASE")?.trim() || "https://api.openai.com/v1"
    ).replace(/\/$/, "");

    const { text: transcript, truncated } = buildTranscriptForSummary(
      segments as SegmentInput[],
      speakerNames,
    );

    console.log(
      `ai-summary: user=${user.id} segments=${segments.length} chars=${transcript.length} truncated=${truncated}`,
    );

    const systemPrompt = `Ты — юридический AI-ассистент для анализа расшифровок. Отвечай ТОЛЬКО на русском языке.

Проанализируй расшифровку и верни структурированный результат, используя функцию analyze_transcription.

Правила:
- Резюме: 3-5 предложений, ёмко и по существу
- Ключевые моменты: важные решения, аргументы, заявления (до 10)
- Задачи/поручения: конкретные действия, которые нужно выполнить (если есть)
- Настроение: общий тон обсуждения`;

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Проанализируй следующую расшифровку:\n\n${transcript}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_transcription",
              description: "Вернуть структурированный анализ расшифровки",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Краткое резюме содержания (3-5 предложений)",
                  },
                  keyPoints: {
                    type: "array",
                    items: { type: "string" },
                    description: "Ключевые моменты обсуждения (до 10)",
                  },
                  actionItems: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        task: { type: "string" },
                        assignee: { type: "string" },
                      },
                      required: ["task"],
                    },
                    description: "Задачи и поручения",
                  },
                  sentiment: {
                    type: "string",
                    enum: [
                      "neutral",
                      "positive",
                      "negative",
                      "confrontational",
                      "cooperative",
                    ],
                    description: "Общий тон обсуждения",
                  },
                },
                required: ["summary", "keyPoints", "actionItems", "sentiment"],
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "analyze_transcription" },
        },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("OpenAI API error:", response.status, t.slice(0, 500));

      if (response.status === 429) {
        return json(
          429,
          { error: "Превышен лимит запросов. Попробуйте позже." },
          corsHeaders,
        );
      }
      if (response.status === 402) {
        return json(
          402,
          { error: "Недостаточно средств на счёте OpenAI." },
          corsHeaders,
        );
      }
      if (
        response.status === 400 &&
        /context|token|length|maximum/i.test(t)
      ) {
        return json(
          413,
          {
            error:
              "Расшифровка слишком длинная для одного AI-запроса. Попробуйте позже или сократите текст.",
          },
          corsHeaders,
        );
      }
      return json(
        502,
        {
          error: "Ошибка AI-сервиса (OpenAI). Проверьте ключ и баланс.",
        },
        corsHeaders,
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return json(
        500,
        { error: "AI не вернул структурированный ответ" },
        corsHeaders,
      );
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ ...analysis, truncatedSample: truncated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-summary error:", e);
    return json(
      500,
      { error: e instanceof Error ? e.message : "Unknown error" },
      corsHeaders,
    );
  }
});
