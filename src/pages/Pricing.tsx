import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, TIER_LIMITS } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Shield, ArrowLeft, Loader2, Users } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { toast } from "sonner";

const plans = [
  {
    tier: "free" as const,
    name: "Бесплатный",
    price: "0 ₽",
    period: "",
    description: "Попробуйте сервис",
    features: [
      "1 расшифровка навсегда",
      "Не более 2 часов аудио",
      "Краткое AI-резюме",
      "Диаризация спикеров",
      "Экспорт в DOCX",
      "Переименование спикеров",
    ],
    icon: Shield,
    accent: false,
  },
  {
    tier: "basic" as const,
    name: "Базовый",
    price: "2 000 ₽",
    period: "/ мес",
    description: "Для регулярной работы",
    features: [
      "5 расшифровок в месяц",
      "До 10 часов в месяц",
      "Краткое AI-резюме",
      "Все функции бесплатного",
      "История расшифровок",
      "Приоритетная обработка",
    ],
    icon: Zap,
    accent: true,
  },
  {
    tier: "pro" as const,
    name: "Про",
    price: "10 000 ₽",
    period: "/ мес",
    description: "Расширенный доступ",
    features: [
      "Без ограничения по количеству расшифровок",
      "До 50 часов в месяц",
      "Краткое AI-резюме",
      "Все функции базового",
      "Приоритетная поддержка",
    ],
    icon: Crown,
    accent: false,
  },
  {
    tier: "team" as const,
    name: "Команда",
    price: "25 000 ₽",
    period: "/ мес",
    description: "Для организаций",
    features: [
      "До 5 пользователей в команде",
      "До 100 часов аудио в месяц (общий пул команды)",
      "Краткое AI-резюме",
      "Общая история и папки команды",
      "Все функции «Про»",
      "Приглашение по email-ссылке",
    ],
    icon: Users,
    accent: false,
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const subscription = useSubscription();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const paymentSuccess = searchParams.get("payment") === "success";

  const handleSubscribe = async (tier: "basic" | "pro" | "team") => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoadingTier(tier);
    try {
      const url = await subscription.createPayment(tier);
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Не удалось создать платёж. Попробуйте позже.");
      }
    } catch {
      toast.error("Ошибка при создании платежа");
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10 relative">
        <div className="container max-w-5xl mx-auto flex items-center justify-between py-4 px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">На главную</span>
          </Button>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <MobileNav showHome={false} />
          </div>
        </div>
      </header>
      <div className="container max-w-5xl mx-auto px-4 py-8">

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold font-serif text-foreground mb-3">
            Тарифные планы
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Выберите подходящий тариф для вашей работы с расшифровками
          </p>
        </div>

        {paymentSuccess && (
          <div className="mb-8 p-4 rounded-lg bg-muted border border-border text-center">
            <p className="text-foreground font-medium">
              ✅ Оплата прошла успешно! Ваш тариф обновлён.
            </p>
          </div>
        )}

        {!subscription.loading && user && (
          <div className="mb-8 p-4 rounded-lg bg-muted text-center">
            <p className="text-sm text-muted-foreground">
              Текущий тариф:{" "}
              <span className="font-semibold text-foreground">
                {TIER_LIMITS[subscription.tier].label}
              </span>
              {" · "}
              Использовано: <span className="font-semibold">{subscription.totalUsed}</span> всего
              {subscription.tier !== "free" && (
                <>, <span className="font-semibold">{subscription.monthlyUsed}</span> в этом месяце</>
              )}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isCurrent = subscription.tier === plan.tier;
            const Icon = plan.icon;

            return (
              <Card
                key={plan.tier}
                className={`relative flex flex-col ${
                  plan.accent
                    ? "border-accent shadow-lg ring-2 ring-accent/20"
                    : "border-border"
                }`}
              >
                {plan.accent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground">
                    Популярный
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-serif">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="text-center mb-6">
                    <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {plan.tier === "free" ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={isCurrent}
                    >
                      {isCurrent ? "Текущий тариф" : "Бесплатно"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.accent ? "default" : "outline"}
                      disabled={isCurrent || loadingTier === plan.tier}
                      onClick={() => handleSubscribe(plan.tier as "basic" | "pro" | "team")}
                    >
                      {loadingTier === plan.tier ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Создание платежа...</>
                      ) : isCurrent ? (
                        "Текущий тариф"
                      ) : (
                        "Оформить подписку"
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Оплата через ЮKassa. Поддерживаются карты российских банков, СБП и ЮMoney.
        </p>
      </div>
    </div>
  );
}
