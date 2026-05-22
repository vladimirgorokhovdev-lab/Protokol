import { SITE_NAME } from "./siteContact.ts";

const SITE_URL_DEFAULT = "https://xn--j1achabchr0f.xn--p1ai";

export type AuthEmailAction =
  | "signup"
  | "recovery"
  | "magiclink"
  | "invite"
  | "email_change"
  | "email"
  | "reauthentication"
  | string;

export type AuthEmailPayload = {
  token: string;
  token_hash: string;
  token_new?: string;
  token_hash_new?: string;
  redirect_to: string;
  email_action_type: AuthEmailAction;
  site_url: string;
};

export function buildAuthVerifyUrl(
  supabaseUrl: string,
  emailData: AuthEmailPayload,
  tokenHash: string,
  actionType: string,
): string {
  const base = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify`;
  const params = new URLSearchParams({
    token: tokenHash,
    type: actionType,
  });
  if (emailData.redirect_to) {
    params.set("redirect_to", emailData.redirect_to);
  }
  return `${base}?${params.toString()}`;
}

function otpCodeHtml(otp: string, hint: string): string {
  return `
  <div style="margin:28px 0;text-align:center;">
    <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#1a2744;text-transform:uppercase;letter-spacing:0.06em;">
      Код подтверждения
    </p>
    <div style="display:inline-block;padding:20px 28px;background:#f4f6f9;border:2px solid #1a2744;border-radius:12px;">
      <span style="font-size:32px;font-weight:700;letter-spacing:0.2em;color:#1a2744;font-family:ui-monospace,'SF Mono',Consolas,monospace;">
        ${otp}
      </span>
    </div>
    <p style="margin:16px 0 0;font-size:14px;color:#444;">${hint}</p>
  </div>`.trim();
}

function linkFallbackHtml(confirmUrl: string): string {
  return `
  <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;">
    <p style="margin:0 0 8px;font-size:13px;color:#888;">Или подтвердите по ссылке:</p>
    <p style="margin:0 0 12px;">
      <a href="${confirmUrl}" style="font-size:14px;color:#1a2744;font-weight:600;">Открыть ${SITE_NAME}</a>
    </p>
    <p style="margin:0;font-size:11px;color:#aaa;word-break:break-all;">${confirmUrl}</p>
  </div>`.trim();
}

function wrapHtml(
  title: string,
  body: string,
  confirmUrl: string,
  opts?: { otp?: string; otpHint?: string; codeFirst?: boolean },
) {
  const { otp, otpHint, codeFirst } = opts ?? {};
  const otpBlock = otp && otpHint ? otpCodeHtml(otp, otpHint) : "";
  const linkBlock = linkFallbackHtml(confirmUrl);

  const main =
    codeFirst && otp
      ? `${body}${otpBlock}${linkBlock}`
      : `${body}
  <p style="margin:24px 0;">
    <a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#1a2744;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Перейти по ссылке</a>
  </p>
  ${otp ? `<p style="font-size:13px;color:#666;">Код: <strong>${otp}</strong></p>` : ""}
  <p style="font-size:12px;color:#888;word-break:break-all;">${confirmUrl}</p>`;

  return `
<!DOCTYPE html>
<html lang="ru">
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#1a2744;margin:0 0 16px;">${title}</h2>
  ${main}
  <p style="font-size:12px;color:#888;margin-top:32px;">Если вы не запрашивали это письмо — просто проигнорируйте его.<br>С уважением, команда ${SITE_NAME}</p>
</body>
</html>`.trim();
}

function textWithCodeFirst(
  intro: string[],
  otp: string,
  otpHint: string,
  confirmUrl: string,
  site: string,
): string {
  return [
    ...intro,
    ``,
    `КОД ПОДТВЕРЖДЕНИЯ: ${otp}`,
    ``,
    otpHint,
    ``,
    `Или по ссылке: ${confirmUrl}`,
    ``,
    `Сайт: ${site}`,
  ].join("\n");
}

export function buildAuthEmailContent(
  action: AuthEmailAction,
  confirmUrl: string,
  otp: string,
): { subject: string; text: string; html: string } {
  const site = SITE_URL_DEFAULT;
  const authPath = `${site}/auth`;

  switch (action) {
    case "signup":
      return {
        subject: `Код ${otp} — подтверждение email · ${SITE_NAME}`,
        text: textWithCodeFirst(
          [
            `Здравствуйте!`,
            `Вы зарегистрировались в ${SITE_NAME}.`,
          ],
          otp,
          `Введите этот код на странице входа (${authPath}) — 8 цифр в поле подтверждения.`,
          confirmUrl,
          site,
        ),
        html: wrapHtml(
          "Подтвердите email",
          `<p>Вы зарегистрировались в <strong>${SITE_NAME}</strong>. Введите код ниже на сайте, чтобы начать расшифровку.</p>`,
          confirmUrl,
          {
            otp,
            otpHint: `Введите код на странице <a href="${authPath}" style="color:#1a2744;">входа</a> (8 цифр).`,
            codeFirst: true,
          },
        ),
      };
    case "recovery":
      return {
        subject: `Сброс пароля — ${SITE_NAME}`,
        text: textWithCodeFirst(
          [`Запрошен сброс пароля в ${SITE_NAME}.`],
          otp,
          `Введите код на сайте или используйте ссылку ниже.`,
          confirmUrl,
          site,
        ),
        html: wrapHtml(
          "Сброс пароля",
          `<p>Вы запросили сброс пароля. Если это были не вы — проигнорируйте письмо.</p>`,
          confirmUrl,
          {
            otp,
            otpHint: "Введите код на сайте или воспользуйтесь ссылкой ниже.",
            codeFirst: true,
          },
        ),
      };
    case "magiclink":
      return {
        subject: `Вход в ${SITE_NAME}`,
        text: `Войти по ссылке: ${confirmUrl}`,
        html: wrapHtml(
          "Вход по ссылке",
          `<p>Используйте ссылку для входа в ${SITE_NAME}.</p>`,
          confirmUrl,
          { otp, otpHint: "Или введите код на сайте." },
        ),
      };
    case "invite":
      return {
        subject: `Приглашение в ${SITE_NAME}`,
        text: textWithCodeFirst(
          [`Вас пригласили в ${SITE_NAME}.`],
          otp,
          `Введите код на сайте или перейдите по ссылке.`,
          confirmUrl,
          site,
        ),
        html: wrapHtml(
          "Приглашение",
          `<p>Вас пригласили в ${SITE_NAME}.</p>`,
          confirmUrl,
          { otp, otpHint: "Введите код на сайте.", codeFirst: true },
        ),
      };
    default:
      return {
        subject: `Уведомление — ${SITE_NAME}`,
        text: otp
          ? textWithCodeFirst(
            [`Действие в ${SITE_NAME}.`],
            otp,
            "Введите код на сайте.",
            confirmUrl,
            site,
          )
          : `Ссылка: ${confirmUrl}`,
        html: wrapHtml(
          "Уведомление",
          `<p>Действие в ${SITE_NAME}.</p>`,
          confirmUrl,
          otp
            ? { otp, otpHint: "Введите код на сайте.", codeFirst: true }
            : undefined,
        ),
      };
  }
}
