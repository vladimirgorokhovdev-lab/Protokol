import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeadersForRequest, handleCorsPreflight } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  const corsHeaders = corsHeadersForRequest(req);

  try {
    // Require authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { segments, speakerNames } = await req.json();

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return new Response(JSON.stringify({ error: "No segments provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build transcript text for the prompt
    const transcript = segments.map((s: any) => {
      const speaker = speakerNames?.[s.speaker] || s.speaker;
      return `[${formatTime(s.startTime)}] ${speaker}: ${s.text}`;
    }).join("\n");

    const systemPrompt = `Ты — юридический AI-ассистент для анализа расшифровок. Отвечай ТОЛЬКО на русском языке.

Проанализируй расшифровку и верни структурированный результат, используя функцию analyze_transcription.

Правила:
- Резюме: 3-5 предложений, ёмко и по существу
- Ключевые моменты: важные решения, аргументы, заявления (до 10)
- Задачи/поручения: конкретные действия, которые нужно выполнить (если есть)
- Настроение: общий тон обсуждения`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Проанализируй следующую расшифровку:\n\n${transcript}` },
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
                  summary: { type: "string", description: "Краткое резюме содержания (3-5 предложений)" },
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
                  sentiment: { type: "string", enum: ["neutral", "positive", "negative", "confrontational", "cooperative"], description: "Общий тон обсуждения" },
                },
                required: ["summary", "keyPoints", "actionItems", "sentiment"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_transcription" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Превышен лимит запросов. Попробуйте позже." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Недостаточно средств для AI-анализа." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Ошибка AI-сервиса" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI не вернул структурированный ответ" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
