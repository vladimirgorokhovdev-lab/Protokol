import { Link } from "react-router-dom";
import { Mail, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from "@/lib/siteContact";

const SUPPORT_HOURS = "Пн–Пт, 10:00–19:00 МСК";

export function SupportSection() {
  return (
    <section
      id="support"
      aria-labelledby="support-heading"
      className="border-t border-border bg-card/40"
    >
      <div className="container max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2
            id="support-heading"
            className="text-2xl sm:text-3xl font-serif font-bold text-foreground mb-2"
          >
            Техническая поддержка
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            Если возникли вопросы по работе сервиса — напишите нам. Мы поможем
            разобраться.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-w-2xl mx-auto">
          <a
            href={`mailto:${SUPPORT_EMAIL_MAILTO}`}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background p-6 min-h-[140px] hover:border-accent transition-colors"
          >
            <Mail className="w-6 h-6 text-accent" aria-hidden="true" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              E-mail
            </span>
            <span className="text-sm font-medium text-foreground break-all text-center">
              {SUPPORT_EMAIL}
            </span>
          </a>

          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background p-6 min-h-[140px]">
            <Clock className="w-6 h-6 text-accent" aria-hidden="true" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Часы работы
            </span>
            <span className="text-sm font-medium text-foreground text-center">
              {SUPPORT_HOURS}
            </span>
          </div>
        </div>

        <div className="flex justify-center">
          <Button asChild size="lg" className="gap-2">
            <Link to="/contact">
              <MessageSquare className="w-4 h-4" />
              Написать нам
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
