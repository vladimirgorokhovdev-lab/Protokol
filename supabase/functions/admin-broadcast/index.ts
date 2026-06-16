import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersForRequest, handleCorsPreflight } from "../_shared/cors.ts";
import { SITE_NAME, SUPPORT_EMAIL } from "../_shared/siteContact.ts";
import { sendSmtpMail } from "../_shared/smtp.ts";

const MAX_RECIPIENTS = 50;
const MAX_SUBJECT = 200;
const MAX_BODY = 12000;

function isValidEmail(email: string): boolean {
  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textToHtml(text: string): string {
  return escapeHtml(text).replaceAll("\n", "<br>\n");
}

async function assertAdmin(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !error && Boolean(data);
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  const corsHeaders = corsHeadersForRequest(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!(await assertAdmin(supabase, user.id))) {
      return new Response(JSON.stringify({ error: "Доступ запрещён" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const subject = String(body?.subject ?? "").trim();
    const message = String(body?.message ?? "").trim();
    const rawEmails = Array.isArray(body?.emails) ? body.emails : [];

    if (!subject || subject.length > MAX_SUBJECT) {
      return new Response(
        JSON.stringify({ error: `Укажите тему (до ${MAX_SUBJECT} символов)` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!message || message.length > MAX_BODY) {
      return new Response(
        JSON.stringify({ error: `Укажите текст (до ${MAX_BODY} символов)` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const emails = [
      ...new Set(
        rawEmails
          .map((e: unknown) => String(e ?? "").trim().toLowerCase())
          .filter((e: string) => isValidEmail(e)),
      ),
    ];

    if (emails.length === 0) {
      return new Response(JSON.stringify({ error: "Нет корректных email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (emails.length > MAX_RECIPIENTS) {
      return new Response(
        JSON.stringify({
          error: `Не более ${MAX_RECIPIENTS} получателей за раз`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const fromEmail = Deno.env.get("SMTP_FROM") ?? Deno.env.get("SMTP_USER") ??
      SUPPORT_EMAIL;
    const htmlBody = textToHtml(message);
    const html = `
      <div style="font-family:sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px">
        ${htmlBody}
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e5" />
        <p style="font-size:12px;color:#888">${escapeHtml(SITE_NAME)} · ${escapeHtml(fromEmail)}</p>
      </div>
    `.trim();

    const textFooter = `\n\n—\n${SITE_NAME}\n${fromEmail}`;

    let sent = 0;
    const failed: Array<{ email: string; error: string }> = [];

    for (const to of emails) {
      try {
        await sendSmtpMail({
          to,
          subject,
          text: message + textFooter,
          html,
          replyTo: fromEmail,
        });
        sent++;
      } catch (e) {
        failed.push({
          email: to,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    console.log(
      `admin-broadcast by ${user.id}: sent=${sent} failed=${failed.length}`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        sent,
        failed: failed.length,
        errors: failed.slice(0, 10),
        from: fromEmail,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("admin-broadcast error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Ошибка" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
