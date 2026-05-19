import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersForRequest, handleCorsPreflight } from "../_shared/cors.ts";
import { SITE_NAME, SUPPORT_EMAIL } from "../_shared/siteContact.ts";
import { sendSmtpMail } from "../_shared/smtp.ts";

const MAX_NAME = 200;
const MAX_EMAIL = 254;
const MAX_MESSAGE = 8000;

function isValidEmail(email: string): boolean {
  return (
    email.length <= MAX_EMAIL &&
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

async function sendContactEmail(params: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  const to = Deno.env.get("CONTACT_TO") ?? Deno.env.get("SMTP_FROM") ?? SUPPORT_EMAIL;

  const subject = `[${SITE_NAME}] Сообщение с сайта от ${params.name}`;
  const text = [
    "Новое сообщение с формы «Написать нам»",
    "",
    `Имя: ${params.name}`,
    `Email для ответа: ${params.email}`,
    "",
    "Сообщение:",
    params.message,
  ].join("\n");

  const html = `
    <p>Новое сообщение с формы «Написать нам» на сайте ${SITE_NAME}.</p>
    <p><strong>Имя:</strong> ${escapeHtml(params.name)}</p>
    <p><strong>Email для ответа:</strong> <a href="mailto:${escapeHtml(params.email)}">${escapeHtml(params.email)}</a></p>
    <p><strong>Сообщение:</strong></p>
    <pre style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(params.message)}</pre>
  `.trim();

  await sendSmtpMail({
    to,
    subject,
    text,
    html,
    replyTo: params.email,
  });
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
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim();
    const message = String(body?.message ?? "").trim();
    const honeypot = String(body?.website ?? "").trim();

    if (honeypot) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Заполните все поля" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (name.length > MAX_NAME || message.length > MAX_MESSAGE) {
      return new Response(JSON.stringify({ error: "Слишком длинное сообщение" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Некорректный email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const anon = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await anon.auth.getUser();
      userId = user?.id ?? null;
    }

    await sendContactEmail({ name, email, message });

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceKey) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        serviceKey,
      );
      await admin.from("contact_messages").insert({
        user_id: userId,
        name,
        email,
        message,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("contact-send error:", err);
    return new Response(
      JSON.stringify({
        error: "Не удалось отправить сообщение. Попробуйте позже или напишите на почту напрямую.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
