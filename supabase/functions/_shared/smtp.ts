import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { SITE_NAME, SUPPORT_EMAIL } from "./siteContact.ts";

export type SmtpMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export async function sendSmtpMail(mail: SmtpMail): Promise<void> {
  const host = Deno.env.get("SMTP_HOST") ?? "mail.hosting.reg.ru";
  const port = Number(Deno.env.get("SMTP_PORT") ?? "465");
  const user = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASSWORD");
  const fromEmail = Deno.env.get("SMTP_FROM") ?? user ?? SUPPORT_EMAIL;
  const fromName = Deno.env.get("SMTP_FROM_NAME") ?? SITE_NAME;

  if (!user || !password) {
    throw new Error(
      "SMTP не настроен: задайте SMTP_USER и SMTP_PASSWORD в секретах Edge Functions",
    );
  }

  const from =
    fromName && fromEmail
      ? `${fromName} <${fromEmail}>`
      : fromEmail;

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls: true,
      auth: { username: user, password },
    },
  });

  try {
    await client.send({
      from,
      to: mail.to,
      replyTo: mail.replyTo,
      subject: mail.subject,
      content: mail.text,
      html: mail.html,
    });
  } finally {
    await client.close();
  }
}
