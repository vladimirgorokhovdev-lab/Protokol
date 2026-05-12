import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Crown, Zap, Shield, CreditCard, Calendar, CheckCircle2, Clock, XCircle, Loader2, User as UserIcon, LogOut, RefreshCw, CalendarClock, CalendarX, AlertCircle, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, TIER_LIMITS } from "@/hooks/useSubscription";
import { useTeam } from "@/hooks/useTeam";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { CancelSurveyDialog } from "@/components/CancelSurveyDialog";

type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  tier: string;
  yookassa_payment_id: string | null;
  created_at: string;
};

const TIER_ICON: Record<string, typeof Crown> = {
  free: Shield,
  basic: Zap,
  pro: Crown,
};

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  succeeded: { label: "Оплачено", icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400" },
  pending: { label: "Ожидает оплаты", icon: Clock, cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400" },
  canceled: { label: "Отменён", icon: XCircle, cls: "text-muted-foreground bg-muted" },
  failed: { label: "Ошибка", icon: XCircle, cls: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400" },
};

const formatAmount = (amount: number, currency: string) => {
  const value = amount / 100;
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency || "RUB",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatPeriodEnd = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const pluralizeDays = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "дня";
  return "дней";
};

export default function Account() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const sub = useSubscription();
  const team = useTeam();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [savingAutoRenew, setSavingAutoRenew] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => {
      sub.refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") sub.refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const id = setInterval(() => sub.refresh(), 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate("/auth", { replace: true });
    }
  }, [user, navigate]);

  const loadPayments = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, currency, status, tier, yookassa_payment_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setPayments(data as PaymentRow[]);
    setLoadingPayments(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoadingPayments(true);
    loadPayments();
  }, [user, loadPayments]);

  const refreshRef = useRef(sub.refresh);
  refreshRef.current = sub.refresh;
  const prevPeriodEndRef = useRef<string | null>(sub.periodEnd ?? null);
  const prevTierRef = useRef<string>(sub.tier);
  const prevStatusRef = useRef<string>(sub.status);
  useEffect(() => {
    prevPeriodEndRef.current = sub.periodEnd ?? null;
    prevTierRef.current = sub.tier;
    prevStatusRef.current = sub.status;
  }, [sub.periodEnd, sub.tier, sub.status]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`account-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newRow = (payload.new ?? {}) as {
            current_period_end?: string | null;
            tier?: string;
            status?: string;
          };
          const newEnd = newRow.current_period_end ?? null;
          const prevEnd = prevPeriodEndRef.current;
          const prevTier = prevTierRef.current;
          const prevStatus = prevStatusRef.current;

          if (newEnd && (!prevEnd || new Date(newEnd).getTime() > new Date(prevEnd).getTime())) {
            const formatted = new Date(newEnd).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            toast({
              title: "Подписка продлена",
              description: `Следующее списание: ${formatted}`,
            });
          }

          if (
            newRow.status &&
            newRow.status !== prevStatus &&
            (newRow.status === "cancelled" || newRow.status === "canceled" || newRow.status === "expired")
          ) {
            toast({
              variant: "destructive",
              title: newRow.status === "expired" ? "Подписка истекла" : "Подписка отменена",
              description:
                newRow.status === "expired"
                  ? "Срок действия подписки закончился. Доступ к платным функциям приостановлен."
                  : "Автопродление прекращено. Чтобы возобновить — оплатите тариф снова.",
            });
          }

          if (
            newRow.tier &&
            newRow.tier !== prevTier &&
            newRow.tier === "free" &&
            prevTier !== "free"
          ) {
            toast({
              variant: "destructive",
              title: "Тариф понижен до бесплатного",
              description: "Не удалось продлить подписку. Проверьте способ оплаты и оформите тариф заново.",
            });
          }

          prevPeriodEndRef.current = newEnd;
          if (newRow.tier) prevTierRef.current = newRow.tier;
          if (newRow.status) prevStatusRef.current = newRow.status;
          refreshRef.current();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payments", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = (payload.new ?? {}) as { amount?: number; currency?: string; status?: string };
          if (row.status === "succeeded") {
            const amount = ((row.amount ?? 0) / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2 });
            toast({
              title: "Оплата получена",
              description: `${amount} ${row.currency ?? "RUB"} зачислено на счёт`,
            });
          } else if (row.status === "canceled" || row.status === "cancelled" || row.status === "failed") {
            toast({
              variant: "destructive",
              title: row.status === "failed" ? "Платёж не прошёл" : "Платёж отменён",
              description:
                row.status === "failed"
                  ? "ЮKassa отклонила платёж. Проверьте карту и попробуйте снова."
                  : "Платёж был отменён. Подписка не активирована.",
            });
          } else {
            toast({
              title: "Новый платёж",
              description: "Платёж создан и ожидает подтверждения",
            });
          }
          refreshRef.current();
          loadPayments();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payments", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newRow = (payload.new ?? {}) as { amount?: number; currency?: string; status?: string };
          const oldRow = (payload.old ?? {}) as { status?: string };
          if (newRow.status === "succeeded" && oldRow.status !== "succeeded") {
            const amount = ((newRow.amount ?? 0) / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2 });
            toast({
              title: "Оплата подтверждена",
              description: `${amount} ${newRow.currency ?? "RUB"} успешно зачислено`,
            });
          } else if (
            (newRow.status === "canceled" || newRow.status === "cancelled" || newRow.status === "failed") &&
            oldRow.status !== newRow.status
          ) {
            const amount = ((newRow.amount ?? 0) / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2 });
            toast({
              variant: "destructive",
              title: newRow.status === "failed" ? "Платёж не прошёл" : "Платёж отменён",
              description: `${amount} ${newRow.currency ?? "RUB"} — ${
                newRow.status === "failed"
                  ? "ЮKassa отклонила платёж. Попробуйте другую карту."
                  : "транзакция отменена."
              }`,
            });
          } else if (newRow.status === "refunded" && oldRow.status !== "refunded") {
            const amount = ((newRow.amount ?? 0) / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2 });
            toast({
              title: "Возврат выполнен",
              description: `${amount} ${newRow.currency ?? "RUB"} возвращено на карту.`,
            });
          }
          refreshRef.current();
          loadPayments();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadPayments]);


  if (!user) return null;

  const tierMeta = TIER_LIMITS[sub.tier];
  const TierIcon = TIER_ICON[sub.tier] ?? Shield;
  const periodStart = formatPeriodEnd(sub.periodStart);
  const periodEnd = formatPeriodEnd(sub.periodEnd);

  const monthlyLimit = tierMeta.monthly === Infinity ? null : tierMeta.monthly;
  const totalLimit = tierMeta.total === Infinity ? null : tierMeta.total;
  const monthlyPct = monthlyLimit ? Math.min(100, (sub.monthlyUsed / monthlyLimit) * 100) : 0;
  const totalPct = totalLimit ? Math.min(100, (sub.totalUsed / totalLimit) * 100) : 0;

  const isActivePaid = sub.tier !== "free" && sub.status === "active";

  const handleAutoRenewToggle = async (value: boolean) => {
    if (!value && isActivePaid) {
      setCancelDialogOpen(true);
      return;
    }
    setSavingAutoRenew(true);
    const ok = await sub.setAutoRenew(value);
    setSavingAutoRenew(false);
    if (ok) {
      toast({
        title: value ? "Автопродление включено" : "Автопродление отключено",
        description: value
          ? "Подписка будет автоматически продлена в конце оплаченного периода."
          : "Подписка завершится в конце оплаченного периода. Доступ сохранится до этой даты.",
      });
    } else {
      toast({
        title: "Не удалось сохранить",
        description: "Попробуйте ещё раз или напишите в поддержку.",
        variant: "destructive",
      });
    }
  };

  const confirmCancel = async (): Promise<boolean> => {
    setSavingAutoRenew(true);
    const ok = await sub.setAutoRenew(false);
    setSavingAutoRenew(false);
    return ok;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto flex items-center justify-between py-4 px-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">На главную</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <MobileNav showHome={false} />
          </div>
        </div>
      </header>

      <div className="container max-w-4xl mx-auto px-4 py-8 sm:py-10 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-playfair text-foreground">
              Личный кабинет
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <UserIcon className="w-4 h-4" />
              {user.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/account/profile")}>
              <UserIcon className="w-4 h-4 mr-2" />
              Профиль
            </Button>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="w-4 h-4 mr-2" />
              Выйти
            </Button>
          </div>
        </div>

        <Card className="border-border overflow-hidden">
          <div className="bg-navy text-primary-foreground px-6 py-5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gold/20 flex items-center justify-center">
                <TierIcon className="w-6 h-6 text-gold" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-primary-foreground/70">
                  Текущий тариф
                </p>
                <p className="text-xl font-semibold font-playfair">{tierMeta.label}</p>
              </div>
            </div>
            <Badge
              className={
                isActivePaid
                  ? "bg-gold text-navy hover:bg-gold/90"
                  : sub.tier === "free"
                  ? "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/20"
                  : "bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
              }
            >
              {sub.loading
                ? "Загрузка…"
                : isActivePaid
                ? "Активна"
                : sub.tier === "free"
                ? "Бесплатный план"
                : sub.status}
            </Badge>
          </div>

          <CardContent className="p-6 space-y-5">
            {(periodStart || periodEnd) && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span>
                    Период оплаты:{" "}
                    <span className="font-medium text-foreground">
                      {periodStart ?? "—"} – {periodEnd ?? "—"}
                    </span>
                  </span>
                  {periodEnd && (
                    <span className="text-xs text-muted-foreground/80">
                      {sub.autoRenew
                        ? `Будет автоматически продлён ${periodEnd}`
                        : `Подписка завершится ${periodEnd}`}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {monthlyLimit !== null && (
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Расшифровок в этом месяце</span>
                    <span className="font-medium text-foreground">
                      {sub.monthlyUsed} / {monthlyLimit}
                    </span>
                  </div>
                  <Progress value={monthlyPct} className="h-2" />
                </div>
              )}

              {totalLimit !== null && (
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Использовано всего</span>
                    <span className="font-medium text-foreground">
                      {sub.totalUsed} / {totalLimit}
                    </span>
                  </div>
                  <Progress value={totalPct} className="h-2" />
                </div>
              )}

              {monthlyLimit === null && totalLimit === null && (
                <div className="text-sm text-muted-foreground">
                  Без ограничений по количеству расшифровок. Использовано всего:{" "}
                  <span className="font-medium text-foreground">{sub.totalUsed}</span>.
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => navigate("/pricing")} className="bg-navy hover:bg-navy-light">
                <CreditCard className="w-4 h-4 mr-2" />
                {sub.tier === "free" ? "Выбрать тариф" : "Изменить тариф"}
              </Button>
              <Button variant="outline" onClick={() => navigate("/history")}>
                История расшифровок
              </Button>
            </div>
          </CardContent>
        </Card>

        {team.team && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="font-playfair text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-gold-dark" />
                Команда
              </CardTitle>
              <CardDescription>
                Вы состоите в команде с общим доступом к расшифровкам и папкам.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Название</p>
                  <p className="font-medium text-foreground truncate">{team.team.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Ваша роль</p>
                  <Badge
                    className={
                      team.role === "owner"
                        ? "bg-gold text-navy hover:bg-gold/90 mt-1"
                        : "bg-muted text-foreground hover:bg-muted/80 mt-1"
                    }
                  >
                    {team.role === "owner" ? (
                      <>
                        <Crown className="w-3 h-3 mr-1" />
                        Владелец
                      </>
                    ) : (
                      "Участник"
                    )}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Участников</p>
                  <p className="font-medium text-foreground">{team.members.length} / 5</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" onClick={() => navigate("/team")}>
                  <Users className="w-4 h-4 mr-2" />
                  Управление командой
                </Button>
                {team.role === "member" && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={async () => {
                      if (!confirm("Выйти из команды? Доступ к общим расшифровкам будет потерян.")) return;
                      const result = await team.leaveTeam();
                      if (result.ok) {
                        toast({ title: "Вы покинули команду" });
                      } else {
                        toast({
                          title: "Не удалось выйти из команды",
                          description: result.error || "Попробуйте ещё раз.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Выйти из команды
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {sub.tier !== "free" && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="font-playfair text-lg flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-gold-dark" />
                Автопродление
              </CardTitle>
              <CardDescription>
                Управляйте автоматическим продлением подписки в конце оплаченного периода.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-muted/30">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">
                      Автопродление подписки
                    </p>
                    <Badge
                      variant="outline"
                      className={
                        sub.autoRenew
                          ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                          : "border-border text-muted-foreground"
                      }
                    >
                      {sub.autoRenew ? "Включено" : "Отключено"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sub.autoRenew
                      ? `Тариф «${tierMeta.label}» будет автоматически продлён${periodEnd ? ` ${periodEnd}` : ""}.`
                      : `Подписка завершится${periodEnd ? ` ${periodEnd}` : " в конце периода"}, после чего вы перейдёте на бесплатный план.`}
                  </p>
                </div>
                <Switch
                  checked={sub.autoRenew}
                  onCheckedChange={handleAutoRenewToggle}
                  disabled={savingAutoRenew || sub.loading}
                  aria-label="Автопродление подписки"
                />
              </div>

              {periodEnd && (() => {
                const endDate = sub.periodEnd ? new Date(sub.periodEnd) : null;
                const daysLeft = endDate
                  ? Math.max(0, Math.ceil((endDate.getTime() - now) / (1000 * 60 * 60 * 24)))
                  : null;
                const Icon = sub.autoRenew ? CalendarClock : CalendarX;
                const title = sub.autoRenew ? "Следующее списание" : "Окончание подписки";
                const cls = sub.autoRenew
                  ? "border-gold/40 bg-gold/5"
                  : "border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20";
                const iconCls = sub.autoRenew ? "text-gold-dark" : "text-amber-600 dark:text-amber-400";
                return (
                  <div className={`flex items-start gap-3 p-4 rounded-xl border ${cls}`}>
                    <div className={`w-10 h-10 rounded-lg bg-background/60 flex items-center justify-center shrink-0 ${iconCls}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        {title}
                      </p>
                      <p className="text-base font-semibold text-foreground mt-0.5">
                        {periodEnd}
                      </p>
                      {daysLeft !== null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {daysLeft === 0
                            ? "Сегодня"
                            : `Через ${daysLeft} ${pluralizeDays(daysLeft)}`}
                          {sub.autoRenew
                            ? ` будет списана оплата за тариф «${tierMeta.label}».`
                            : ` доступ к платным функциям прекратится.`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  sub.paymentMethodSaved
                    ? "border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20"
                    : "border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg bg-background/60 flex items-center justify-center shrink-0 ${
                    sub.paymentMethodSaved
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {sub.paymentMethodSaved ? (
                    <CreditCard className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">
                      {sub.paymentMethodSaved ? "Карта сохранена" : "Карта не сохранена"}
                    </p>
                    <Badge
                      variant="outline"
                      className={
                        sub.paymentMethodSaved
                          ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-[10px]"
                          : "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 text-[10px]"
                      }
                    >
                      {sub.paymentMethodSaved ? "Готово к автосписаниям" : "Требуется оплата"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {sub.paymentMethodSaved
                      ? "Следующее продление пройдёт автоматически по сохранённой карте."
                      : "При следующей оплате карта будет сохранена для автоматических списаний."}
                  </p>
                </div>
              </div>

              {!sub.autoRenew && (
                <p className="text-xs text-muted-foreground">
                  Передумали? Включите переключатель, чтобы возобновить автопродление до окончания текущего периода.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* История платежей */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-playfair text-lg">История платежей</CardTitle>
            <CardDescription>
              Все ваши транзакции через ЮKassa в одном месте
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPayments ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Загрузка платежей…
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-border rounded-xl">
                <CreditCard className="w-8 h-8 text-muted-foreground/60 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  У вас пока нет платежей.
                </p>
                <Button
                  variant="link"
                  className="text-gold-dark"
                  onClick={() => navigate("/pricing")}
                >
                  Посмотреть тарифы
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {payments.map((p) => {
                  const meta = STATUS_META[p.status] ?? {
                    label: p.status,
                    icon: Clock,
                    cls: "text-muted-foreground bg-muted",
                  };
                  const StatusIcon = meta.icon;
                  const tierLabel = TIER_LIMITS[p.tier as keyof typeof TIER_LIMITS]?.label ?? p.tier;
                  return (
                    <li
                      key={p.id}
                      className="py-3 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.cls}`}>
                          <StatusIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            Тариф «{tierLabel}»
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {formatDate(p.created_at)}
                            {p.yookassa_payment_id && (
                              <> · ID {p.yookassa_payment_id.slice(0, 8)}…</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-12 sm:ml-0">
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {meta.label}
                        </span>
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {formatAmount(p.amount, p.currency)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          По вопросам оплаты —{" "}
          <Link to="/feedback" className="text-gold-dark hover:underline">
            напишите в поддержку
          </Link>
          .
        </p>
      </div>
      <CancelSurveyDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        tier={sub.tier}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
