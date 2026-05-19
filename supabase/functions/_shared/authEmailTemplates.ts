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

function wrapHtml(title: string, body: string, confirmUrl: string, otp?: string) {
  const otpBlock = otp
    ? `<p style="font-size:13px;color:#666;">Или введите код: <strong>${otp}</strong></p>`
    : "";
  return `
<!DOCTYPE html>
<html lang="ru">
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#1a2744;margin:0 0 16px;">${title}</h2>
  ${body}
  <p style="margin:24px 0;">
    <a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#1a2744;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Перейти по ссылке</a>
  </p>
  ${otpBlock}
  <p style="font-size:12px;color:#888;word-break:break-all;">Если кнопка не работает, скопируйте ссылку:<br>${confirmUrl}</p>
  <p style="font-size:12px;color:#888;margin-top:24px;">Если вы не запрашивали это письмо — просто проигнорируйте его.<br>С уважением, команда ${SITE_NAME}</p>
</body>
</html>`.trim();
}

export function buildAuthEmailContent(
  action: AuthEmailAction,
  confirmUrl: string,
  otp: string,
): { subject: string; text: string; html: string } {
  const site = SITE_URL_DEFAULT;

  switch (action) {
    case "signup":
      return {
        subject: `Подтвердите email — ${SITE_NAME}`,
        text: [
          `Здравствуйте!`,
          ``,
          `Вы зарегистрировались в сервисе ${SITE_NAME}.`,
          `Подтвердите адрес, перейдя по ссылке:`,
          confirmUrl,
          otp ? `\nКод: ${otp}` : "",
          ``,
          `Сайт: ${site}`,
        ].join("\n"),
        html: wrapHtml(
          "Подтвердите email",
          `<p>Вы зарегистрировались в <strong>${SITE_NAME}</strong>. Подтвердите адрес, чтобы начать расшифровку.</p>`,
          confirmUrl,
          otp,
        ),
      };
    case "recovery":
      return {
        subject: `Сброс пароля — ${SITE_NAME}`,
        text: [
          `Запрошен сброс пароля в ${SITE_NAME}.`,
          `Ссылка: ${confirmUrl}`,
          otp ? `Код: ${otp}` : "",
        ].join("\n"),
        html: wrapHtml(
          "Сброс пароля",
          `<p>Вы запросили сброс пароля. Если это были не вы — проигнорируйте письмо.</p>`,
          confirmUrl,
          otp,
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
          otp,
        ),
      };
    case "invite":
      return {
        subject: `Приглашение в ${SITE_NAME}`,
        text: `Вас пригласили. Принять: ${confirmUrl}`,
        html: wrapHtml(
          "Приглашение",
          `<p>Вас пригласили в ${SITE_NAME}. Нажмите кнопку, чтобы принять приглашение.</p>`,
          confirmUrl,
          otp,
        ),
      };
    default:
      return {
        subject: `Уведомление — ${SITE_NAME}`,
        text: `Ссылка: ${confirmUrl}`,
        html: wrapHtml(
          "Уведомление",
          `<p>Действие в ${SITE_NAME}.</p>`,
          confirmUrl,
          otp,
        ),
      };
  }
}
