import { useNavigate } from "react-router-dom";
import { Crown, Zap, Shield, ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSubscription,
  TIER_LIMITS,
  formatHoursFromSeconds,
} from "@/hooks/useSubscription";

const tierMeta = {
  free: { icon: Shield, label: "Бесплатный" },
  basic: { icon: Zap, label: "Базовый" },
  pro: { icon: Crown, label: "Про" },
  team: { icon: Users, label: "Команда" },
} as const;

export function SubscriptionBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const sub = useSubscription();

  if (!user || sub.loading) return null;

  const meta = tierMeta[sub.tier];
  const Icon = meta.icon;
  const blocked = !sub.canTranscribe;
  const limits = TIER_LIMITS[sub.tier];

  let usage = "";
  if (sub.tier === "free") {
    usage = `Использовано ${sub.totalUsed} из ${limits.total} расшифровок`;
  } else if (sub.tier === "basic") {
    usage = `В этом месяце: ${sub.monthlyUsed} из ${limits.monthly} расшифровок · ${formatHoursFromSeconds(sub.monthlySecondsUsed)} из ${limits.monthlyHours} ч`;
  } else if (limits.monthlyHours) {
    usage = `В этом месяце: ${formatHoursFromSeconds(sub.monthlySecondsUsed)} из ${limits.monthlyHours} ч`;
  } else {
    usage = sub.periodEnd
      ? `Активен до ${new Date(sub.periodEnd).toLocaleDateString("ru-RU")}`
      : "Без ограничений";
  }

  return (
    <div className={`border-b border-border ${blocked ? "bg-destructive/10" : "bg-muted/40"}`}>
      <div className="container max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${blocked ? "bg-destructive/20" : "bg-primary/10"}`}
          >
            <Icon
              className={`w-4 h-4 ${blocked ? "text-destructive" : "text-primary"}`}
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground leading-tight">
              Тариф: {meta.label}
              {blocked && (
                <span className="ml-2 text-destructive">· Лимит исчерпан</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground leading-tight truncate">
              {usage}
            </div>
          </div>
        </div>
        {sub.tier !== "pro" && sub.tier !== "team" && (
          <Button
            size="sm"
            variant={blocked ? "default" : "outline"}
            onClick={() => navigate("/pricing")}
            className="flex-shrink-0"
          >
            {blocked ? "Оформить подписку" : "Улучшить тариф"}
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        )}
        {sub.tier === "team" && blocked && (
          <Button
            size="sm"
            variant="default"
            onClick={() => navigate("/team")}
            className="flex-shrink-0"
          >
            Пул команды
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
