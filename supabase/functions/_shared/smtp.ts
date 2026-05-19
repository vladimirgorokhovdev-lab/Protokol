import nodemailer from "npm:nodemailer@6.9.10";
import { SITE_NAME, SUPPORT_EMAIL } from "./siteContact.ts";

export type SmtpMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

function smtpTransport() {
  const host = Deno.env.get("SMTP_HOST") ?? "mail.hosting.reg.ru";
  const port = Number(Deno.env.get("SMTP_PORT") ?? "465");
  const user = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASSWORD");

  if (!user || !password) {
    throw new Error(
      "SMTP не настроен: задайте SMTP_USER и SMTP_PASSWORD в секретах Edge Functions",
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
  });
}

export async function sendSmtpMail(mail: SmtpMail): Promise<void> {
  const fromEmail = Deno.env.get("SMTP_FROM") ?? Deno.env.get("SMTP_USER") ??
    SUPPORT_EMAIL;
  const fromName = Deno.env.get("SMTP_FROM_NAME") ?? SITE_NAME;
  const from =
    fromName && fromEmail ? `"${fromName}" <${fromEmail}>` : fromEmail;

  const transport = smtpTransport();

  await new Promise<void>((resolve, reject) => {
    transport.sendMail(
      {
        from,
        to: mail.to,
        replyTo: mail.replyTo,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      },
      (error) => {
        if (error) reject(error);
        else resolve();
      },
    );
  });
}
