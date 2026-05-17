import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from "@/lib/siteContact";

interface LegalRequisitesProps {
  variant?: "footer" | "card";
  className?: string;
}

export const LEGAL_INFO = {
  fullName: "Индивидуальный предприниматель Пахомов Владислав Дмитриевич",
  shortName: "ИП Пахомов В. Д.",
  ogrnip: "325774600846436",
  inn: "561014782129",
  registrationDate: "08.12.2025",
  registrationAuthority: "Межрайонная инспекция ФНС № 46 по г. Москве",
  email: SUPPORT_EMAIL,
  emailMailto: SUPPORT_EMAIL_MAILTO,
} as const;

export function LegalRequisites({ variant = "footer", className = "" }: LegalRequisitesProps) {
  if (variant === "footer") {
    return (
      <div className={`text-xs text-muted-foreground leading-relaxed ${className}`}>
        <p>{LEGAL_INFO.shortName}</p>
        <p>
          ОГРНИП: {LEGAL_INFO.ogrnip} · ИНН: {LEGAL_INFO.inn}
        </p>
        <p>
          E-mail:{" "}
          <a href={`mailto:${LEGAL_INFO.emailMailto}`} className="hover:text-foreground transition-colors">
            {LEGAL_INFO.email}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-border bg-card p-4 text-sm ${className}`}>
      <h3 className="font-serif font-semibold text-foreground mb-2">Реквизиты</h3>
      <dl className="grid gap-1 text-muted-foreground">
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-foreground">Продавец:</dt>
          <dd>{LEGAL_INFO.fullName}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-foreground">ОГРНИП:</dt>
          <dd>{LEGAL_INFO.ogrnip}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-foreground">ИНН:</dt>
          <dd>{LEGAL_INFO.inn}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-foreground">Дата регистрации:</dt>
          <dd>{LEGAL_INFO.registrationDate}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-foreground">Регистрирующий орган:</dt>
          <dd>{LEGAL_INFO.registrationAuthority}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-foreground">E-mail:</dt>
          <dd>
            <a href={`mailto:${LEGAL_INFO.emailMailto}`} className="hover:text-foreground transition-colors underline">
              {LEGAL_INFO.email}
            </a>
          </dd>
        </div>
      </dl>
    </div>
  );
}
