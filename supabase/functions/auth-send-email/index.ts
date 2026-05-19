import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import {
  buildAuthEmailContent,
  buildAuthVerifyUrl,
  type AuthEmailPayload,
} from "../_shared/authEmailTemplates.ts";
import { sendSmtpMail } from "../_shared/smtp.ts";

type HookUser = {
  email: string;
  new_email?: string;
};

type HookBody = {
  user: HookUser;
  email_data: AuthEmailPayload;
};

function hookSecretRaw(): string {
  const raw = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").trim();
  if (!raw) return "";
  // Dashboard: "v1,whsec_<base64>" — standardwebhooks ждёт только base64-часть
  return raw.replace(/^v1,whsec_/, "");
}

function webhookHeaders(req: Request): Record<string, string> {
  const h = req.headers;
  return {
    "webhook-id": h.get("webhook-id") ?? "",
    "webhook-timestamp": h.get("webhook-timestamp") ?? "",
    "webhook-signature": h.get("webhook-signature") ?? "",
  };
}

function supabaseProjectUrl(): string {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL is not set");
  return url;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const secret = hookSecretRaw();
  if (!secret) {
    console.error("SEND_EMAIL_HOOK_SECRET is missing");
    return new Response(JSON.stringify({ error: "Hook secret not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await req.text();
  const headers = webhookHeaders(req);

  let body: HookBody;
  try {
    const wh = new Webhook(secret);
    body = wh.verify(payload, headers) as HookBody;
  } catch (err) {
    console.error(
      "auth-send-email webhook verify failed:",
      err,
      "has-id",
      Boolean(headers["webhook-id"]),
    );
    return new Response(JSON.stringify({ error: "Invalid webhook" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { user, email_data: ed } = body;

  if (!user?.email) {
    console.error("auth-send-email: missing user.email");
    return new Response(
      JSON.stringify({
        error: { http_code: 500, message: "Missing recipient email" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const supabaseUrl = supabaseProjectUrl();

  try {
    const sends: Array<{ to: string; hash: string; type: string; otp: string }> =
      [];

    if (ed.email_action_type === "email_change" && ed.token_hash_new && user.new_email) {
      if (user.email) {
        sends.push({
          to: user.email,
          hash: ed.token_hash_new,
          type: ed.email_action_type,
          otp: ed.token ?? "",
        });
      }
      sends.push({
        to: user.new_email,
        hash: ed.token_hash,
        type: ed.email_action_type,
        otp: ed.token_new ?? ed.token ?? "",
      });
    } else {
      sends.push({
        to: user.email,
        hash: ed.token_hash,
        type: ed.email_action_type,
        otp: ed.token ?? "",
      });
    }

    for (const job of sends) {
      const confirmUrl = buildAuthVerifyUrl(supabaseUrl, ed, job.hash, job.type);
      const content = buildAuthEmailContent(job.type, confirmUrl, job.otp);
      await sendSmtpMail({
        to: job.to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
      console.log(`auth-send-email: sent ${job.type} to ${job.to}`);
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    console.error("auth-send-email send failed:", msg, err);
    return new Response(
      JSON.stringify({
        error: {
          http_code: 500,
          message: msg,
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
