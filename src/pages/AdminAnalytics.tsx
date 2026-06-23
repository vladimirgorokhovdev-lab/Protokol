import { useEffect, useState, useCallback } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApprovalStatus } from "@/hooks/useApprovalStatus";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SUPPORT_EMAIL } from "@/lib/siteContact";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Home,
  RefreshCw,
  Users,
  CreditCard,
  Mic,
  Clock,
  TrendingUp,
  AlertTriangle,
  Search,
  Download,
  Mail,
  Send,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";

const MAX_BROADCAST_ATTACHMENT_BYTES = 4 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Не удалось прочитать файл"));
        return;
      }
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Ошибка чтения файла"));
    reader.readAsDataURL(file);
  });
}

type Overview = {
  period_days: number;
  total_users: number;
  new_users: number;
  active_paid: number;
  auto_renew_off: number;
  transcriptions_period: number;
  seconds_period: number;
  logins_period: number;
  dau: number;
  mau: number;
  cancellations_period: number;
  revenue_period: number;
  by_tier: Record<string, number> | null;
  signups_by_day: Array<{ date: string; count: number }> | null;
};

type SegmentRow = {
  user_id: string;
  email: string;
  registered_at: string;
  tier: string;
  monthly_count: number | null;
  total_count: number | null;
  total_seconds: number | null;
  period_end: string | null;
  last_event_at: string | null;
  context: {
    cancellation: { reason?: string; comment?: string } | null;
    auto_renew: boolean | null;
    status: string | null;
  } | null;
};

const SEGMENTS: Array<{ value: string; label: string; description: string }> = [
  {
    value: "free_exhausted",
    label: "Исчерпали бесплатный лимит",
    description:
      "Зарегистрировались более суток назад, использовали 1 расшифровку, не оплатили.",
  },
  {
    value: "auto_renew_off",
    label: "Отменили автопродление",
    description: "Платный тариф активен, но автосписание отключено.",
  },
  {
    value: "expired_not_renewed",
    label: "Не продлили после истечения",
    description: "Период подписки закончился, новой активной нет.",
  },
  {
    value: "heavy_users",
    label: "Тяжёлые пользователи (≥10ч)",
    description: "Сделали много часов расшифровки — кандидаты в team-тариф.",
  },
  {
    value: "inactive_paid",
    label: "Платящие, но не заходят 14 дней",
    description: "Риск неиспользования тарифа — стоит позвонить.",
  },
  {
    value: "all_active",
    label: "Все пользователи",
    description: "Полный список с базовым контекстом.",
  },
];

const formatHours = (s: number | null) =>
  s ? `${(s / 3600).toFixed(1)} ч` : "0";
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("ru-RU") : "—";
const formatMoney = (kop: number) => `${(kop / 100).toLocaleString("ru-RU")} ₽`;

const reasonLabel = (code?: string) => {
  if (!code) return null;
  const map: Record<string, string> = {
    too_expensive: "Дорого",
    not_using: "Не пользуется",
    missing_feature: "Не хватает функций",
    quality: "Качество",
    switching: "Уходит к другим",
    temporary: "Временно",
    other: "Другое",
  };
  return map[code] || code;
};

const Stat = ({
  icon: Icon,
  title,
  value,
  hint,
  onClick,
}: {
  icon: typeof Users;
  title: string;
  value: string | number;
  hint?: string;
  onClick?: () => void;
}) => (
  <Card
    onClick={onClick}
    className={
      onClick
        ? "cursor-pointer hover:border-gold/60 hover:shadow-md transition-all"
        : ""
    }
  >
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <Icon className="h-8 w-8 text-gold/50" />
      </div>
    </CardContent>
  </Card>
);

type DetailItem = Record<string, unknown>;
const METRIC_TITLES: Record<string, string> = {
  total_users: "Все пользователи (последние 500)",
  new_users: "Новые регистрации",
  active_paid: "Активные платные подписки",
  auto_renew_off: "Без автопродления",
  revenue_period: "Успешные платежи",
  transcriptions_period: "Расшифровки за период",
  seconds_period: "Расшифровки по длительности",
  dau: "Активные за 24 часа",
  mau: "Активные за 30 дней",
  cancellations_period: "Отмены подписки",
};

const AdminAnalytics = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, status, adminLoading } = useApprovalStatus();
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadingOv, setLoadingOv] = useState(false);
  const [segment, setSegment] = useState("free_exhausted");
  const [segRows, setSegRows] = useState<SegmentRow[]>([]);
  const [loadingSeg, setLoadingSeg] = useState(false);
  const [emailQuery, setEmailQuery] = useState("");
  const [card, setCard] = useState<Record<string, unknown> | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);
  const [detailMetric, setDetailMetric] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(
    () => new Set(),
  );
  const [mailOpen, setMailOpen] = useState(false);
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [mailAttachment, setMailAttachment] = useState<File | null>(null);
  const [sendingMail, setSendingMail] = useState(false);

  const openDetails = useCallback(
    async (metric: string) => {
      setDetailMetric(metric);
      setDetailItems([]);
      setLoadingDetails(true);
      const { data, error } = await supabase.rpc("admin_metric_details", {
        p_metric: metric,
        p_days: days,
      });
      if (error) toast.error(error.message);
      else setDetailItems((data as { items?: DetailItem[] })?.items ?? []);
      setLoadingDetails(false);
    },
    [days],
  );

  const loadOverview = useCallback(async () => {
    setLoadingOv(true);
    const { data, error } = await supabase.rpc("admin_analytics_overview", {
      p_days: days,
    });
    if (error) toast.error(error.message);
    else setOverview(data as unknown as Overview);
    setLoadingOv(false);
  }, [days]);

  const loadSegment = useCallback(async () => {
    setLoadingSeg(true);
    setSelectedEmails(new Set());
    const { data, error } = await supabase.rpc("admin_segment_users", {
      p_segment: segment,
    });
    if (error) toast.error(error.message);
    else setSegRows((data as unknown as SegmentRow[]) ?? []);
    setLoadingSeg(false);
  }, [segment]);

  const toggleEmail = (email: string, checked: boolean) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (checked) next.add(email);
      else next.delete(email);
      return next;
    });
  };

  const toggleAllEmails = (checked: boolean) => {
    if (checked) setSelectedEmails(new Set(segRows.map((r) => r.email)));
    else setSelectedEmails(new Set());
  };

  const allSelected =
    segRows.length > 0 && selectedEmails.size === segRows.length;

  const sendBroadcast = async () => {
    const emails = [...selectedEmails];
    if (emails.length === 0) {
      toast.error("Выберите получателей");
      return;
    }
    if (!mailSubject.trim() || !mailBody.trim()) {
      toast.error("Заполните тему и текст письма");
      return;
    }
    if (emails.length > 50) {
      toast.error("Не более 50 получателей за раз");
      return;
    }
    setSendingMail(true);
    try {
      let attachment:
        | { filename: string; contentType: string; contentBase64: string }
        | undefined;
      if (mailAttachment) {
        attachment = {
          filename: mailAttachment.name,
          contentType: mailAttachment.type || "application/octet-stream",
          contentBase64: await readFileAsBase64(mailAttachment),
        };
      }
      const { data, error } = await supabase.functions.invoke("admin-broadcast", {
        body: {
          emails,
          subject: mailSubject.trim(),
          message: mailBody.trim(),
          attachment,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      const result = data as {
        sent?: number;
        failed?: number;
        errors?: Array<{ email: string; error: string }>;
        from?: string;
        error?: string;
      };
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Отправлено: ${result.sent ?? 0}${result.failed ? `, ошибок: ${result.failed}` : ""}`,
      );
      if (result.from) {
        toast.message(`Письма ушли с адреса ${result.from}`);
      }
      if (result.failed && result.errors?.length) {
        console.warn("admin-broadcast errors", result.errors);
      }
      setMailOpen(false);
      setMailSubject("");
      setMailBody("");
      setMailAttachment(null);
      setSelectedEmails(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setSendingMail(false);
    }
  };

  const loadCard = async () => {
    if (!emailQuery.trim()) return;
    setLoadingCard(true);
    const { data, error } = await supabase.rpc("admin_user_card", {
      p_email: emailQuery.trim(),
    });
    if (error) toast.error(error.message);
    else setCard(data as Record<string, unknown>);
    setLoadingCard(false);
  };

  useEffect(() => {
    if (isAdmin) loadOverview();
  }, [isAdmin, loadOverview]);
  useEffect(() => {
    if (isAdmin) loadSegment();
  }, [isAdmin, loadSegment]);

  const exportCsv = () => {
    if (segRows.length === 0) return;
    const header =
      "email;tier;registered_at;monthly_count;total_count;total_hours;period_end;last_event;reason;comment";
    const rows = segRows.map((r) => {
      const c = r.context?.cancellation;
      return [
        r.email,
        r.tier,
        formatDate(r.registered_at),
        r.monthly_count ?? 0,
        r.total_count ?? 0,
        ((r.total_seconds ?? 0) / 3600).toFixed(2),
        formatDate(r.period_end),
        formatDate(r.last_event_at),
        reasonLabel(c?.reason) ?? "",
        (c?.comment ?? "").replace(/[;\n\r]/g, " "),
      ].join(";");
    });
    const blob = new Blob([[header, ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `segment-${segment}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyEmails = () => {
    const list = segRows.map((r) => r.email).join(", ");
    navigator.clipboard
      .writeText(list)
      .then(() => toast.success(`Скопировано ${segRows.length} email`));
  };

  if (authLoading || status === "loading" || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Загрузка…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto flex items-center justify-between py-4 px-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> На главную
          </Link>
          <h1 className="font-serif text-xl">Аналитика</h1>
          <Link to="/admin/requests">
            <Button variant="ghost" size="sm">
              <Home className="h-4 w-4 mr-2" />
              Заявки
            </Button>
          </Link>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-4 py-6 space-y-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="segments">Сегменты</TabsTrigger>
            <TabsTrigger value="user">Карточка пользователя</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="flex items-center gap-3">
              <Select
                value={String(days)}
                onValueChange={(v) => setDays(Number(v))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 дней</SelectItem>
                  <SelectItem value="30">30 дней</SelectItem>
                  <SelectItem value="90">90 дней</SelectItem>
                  <SelectItem value="365">Год</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={loadOverview}
                disabled={loadingOv}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loadingOv ? "animate-spin" : ""}`}
                />{" "}
                Обновить
              </Button>
            </div>

            {overview && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat
                    icon={Users}
                    title="Всего пользователей"
                    value={overview.total_users}
                    onClick={() => openDetails("total_users")}
                  />
                  <Stat
                    icon={TrendingUp}
                    title={`Новых за ${days}д`}
                    value={overview.new_users}
                    onClick={() => openDetails("new_users")}
                  />
                  <Stat
                    icon={CreditCard}
                    title="Платящих"
                    value={overview.active_paid}
                    hint={`${overview.auto_renew_off} без автопродления`}
                    onClick={() => openDetails("active_paid")}
                  />
                  <Stat
                    icon={CreditCard}
                    title={`Доход за ${days}д`}
                    value={formatMoney(overview.revenue_period)}
                    onClick={() => openDetails("revenue_period")}
                  />
                  <Stat
                    icon={Mic}
                    title="Расшифровок"
                    value={overview.transcriptions_period}
                    onClick={() => openDetails("transcriptions_period")}
                  />
                  <Stat
                    icon={Clock}
                    title="Часов аудио"
                    value={(overview.seconds_period / 3600).toFixed(1)}
                    onClick={() => openDetails("seconds_period")}
                  />
                  <Stat
                    icon={Users}
                    title="DAU / MAU"
                    value={`${overview.dau} / ${overview.mau}`}
                    hint="Клик: активные за 24ч"
                    onClick={() => openDetails("dau")}
                  />
                  <Stat
                    icon={AlertTriangle}
                    title="Отмен подписки"
                    value={overview.cancellations_period}
                    hint="С опросом причин"
                    onClick={() => openDetails("cancellations_period")}
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Распределение по тарифам
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {overview.by_tier &&
                        Object.entries(overview.by_tier).map(([tier, cnt]) => (
                          <Badge
                            key={tier}
                            variant="secondary"
                            className="text-sm"
                          >
                            {tier}:{" "}
                            <span className="ml-1 font-bold">{cnt}</span>
                          </Badge>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                {overview.signups_by_day &&
                  overview.signups_by_day.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Регистрации по дням
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-end gap-1 h-32">
                          {overview.signups_by_day.map((d) => {
                            const max = Math.max(
                              ...overview.signups_by_day!.map((x) => x.count),
                              1,
                            );
                            const h = (d.count / max) * 100;
                            return (
                              <div
                                key={d.date}
                                className="flex-1 flex flex-col items-center gap-1 group"
                                title={`${d.date}: ${d.count}`}
                              >
                                <div
                                  className="w-full bg-gold/60 hover:bg-gold rounded-t"
                                  style={{ height: `${h}%` }}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Всего:{" "}
                          {overview.signups_by_day.reduce(
                            (s, d) => s + d.count,
                            0,
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  )}
              </>
            )}
          </TabsContent>

          <TabsContent value="segments" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger className="w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={loadSegment}
                disabled={loadingSeg}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loadingSeg ? "animate-spin" : ""}`}
                />{" "}
                Обновить
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={copyEmails}
                disabled={segRows.length === 0}
              >
                <Mail className="h-4 w-4 mr-2" /> Скопировать email
              </Button>
              <Button
                size="sm"
                onClick={() => setMailOpen(true)}
                disabled={selectedEmails.size === 0}
              >
                <Send className="h-4 w-4 mr-2" />
                Отправить выбранным ({selectedEmails.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={segRows.length === 0}
              >
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
              <span className="text-sm text-muted-foreground">
                Найдено: {segRows.length}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {SEGMENTS.find((s) => s.value === segment)?.description}
            </p>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase">
                    <tr>
                      <th className="p-3 w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(v) => toggleAllEmails(v === true)}
                          aria-label="Выбрать всех"
                        />
                      </th>
                      <th className="text-left p-3">Email</th>
                      <th className="text-left p-3">Тариф</th>
                      <th className="text-left p-3">Регистрация</th>
                      <th className="text-right p-3">Расш./мес</th>
                      <th className="text-right p-3">Всего часов</th>
                      <th className="text-left p-3">Окончание</th>
                      <th className="text-left p-3">Последняя активность</th>
                      <th className="text-left p-3">Причина</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segRows.length === 0 && !loadingSeg && (
                      <tr>
                        <td
                          colSpan={9}
                          className="p-6 text-center text-muted-foreground"
                        >
                          Нет данных
                        </td>
                      </tr>
                    )}
                    {segRows.map((r) => (
                      <tr
                        key={r.user_id}
                        className="border-t border-border hover:bg-muted/30"
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={selectedEmails.has(r.email)}
                            onCheckedChange={(v) =>
                              toggleEmail(r.email, v === true)
                            }
                            aria-label={`Выбрать ${r.email}`}
                          />
                        </td>
                        <td className="p-3">
                          <button
                            className="text-gold-dark hover:underline"
                            onClick={() => {
                              setEmailQuery(r.email);
                              setTimeout(loadCard, 50);
                            }}
                          >
                            {r.email}
                          </button>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{r.tier}</Badge>
                        </td>
                        <td className="p-3">{formatDate(r.registered_at)}</td>
                        <td className="p-3 text-right">
                          {r.monthly_count ?? 0}
                        </td>
                        <td className="p-3 text-right">
                          {formatHours(r.total_seconds)}
                        </td>
                        <td className="p-3">{formatDate(r.period_end)}</td>
                        <td className="p-3">{formatDate(r.last_event_at)}</td>
                        <td className="p-3">
                          {r.context?.cancellation && (
                            <span title={r.context.cancellation.comment ?? ""}>
                              {reasonLabel(r.context.cancellation.reason)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Dialog
              open={mailOpen}
              onOpenChange={(open) => {
                setMailOpen(open);
                if (!open) setMailAttachment(null);
              }}
            >
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Отправить письмо</DialogTitle>
                  <DialogDescription>
                    Получателей: {selectedEmails.size} (макс. 50 за раз).
                    Отправка с{" "}
                    <span className="font-medium text-foreground">
                      {SUPPORT_EMAIL}
                    </span>{" "}
                    через ваш SMTP.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="broadcast-subject">Тема</Label>
                    <Input
                      id="broadcast-subject"
                      value={mailSubject}
                      onChange={(e) => setMailSubject(e.target.value)}
                      placeholder="Например: Обновление сервиса ПротоколЪ"
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="broadcast-body">Текст письма</Label>
                    <Textarea
                      id="broadcast-body"
                      value={mailBody}
                      onChange={(e) => setMailBody(e.target.value)}
                      placeholder="Текст для пользователей…"
                      rows={8}
                      maxLength={12000}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="broadcast-attachment">Вложение</Label>
                    <input
                      id="broadcast-attachment"
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        if (file.size > MAX_BROADCAST_ATTACHMENT_BYTES) {
                          toast.error("Файл не больше 4 МБ");
                          return;
                        }
                        setMailAttachment(file);
                      }}
                    />
                    {mailAttachment ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{mailAttachment.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(mailAttachment.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => setMailAttachment(null)}
                          aria-label="Убрать вложение"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() =>
                          document.getElementById("broadcast-attachment")?.click()
                        }
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Прикрепить файл (до 4 МБ)
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      PDF, Word, Excel, изображения, ZIP, TXT
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Используйте только для сервисных сообщений и ответов
                    пользователям, согласившимся на обработку данных.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setMailOpen(false)}
                      disabled={sendingMail}
                    >
                      Отмена
                    </Button>
                    <Button onClick={sendBroadcast} disabled={sendingMail}>
                      {sendingMail ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Отправить
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="user" className="space-y-4">
            <div className="flex gap-2 max-w-md">
              <Input
                placeholder="email@example.com"
                value={emailQuery}
                onChange={(e) => setEmailQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadCard()}
              />
              <Button onClick={loadCard} disabled={loadingCard}>
                <Search className="h-4 w-4 mr-2" /> Найти
              </Button>
            </div>

            {card && (card as { found: boolean }).found === false && (
              <p className="text-sm text-muted-foreground">
                Пользователь не найден.
              </p>
            )}

            {card &&
              (card as { found: boolean }).found &&
              (() => {
                const c = card as {
                  email: string;
                  registered_at: string;
                  transcriptions_count: number;
                  last_transcription_at: string | null;
                  subscription: {
                    tier: string;
                    status: string;
                    auto_renew: boolean;
                    current_period_end: string | null;
                  } | null;
                  usage: {
                    total_count: number;
                    monthly_count: number;
                    total_seconds: number;
                    monthly_seconds: number;
                  } | null;
                  payments: Array<{
                    id: string;
                    amount: number;
                    tier: string;
                    status: string;
                    created_at: string;
                  }>;
                  cancellations: Array<{
                    reason: string;
                    comment: string | null;
                    created_at: string;
                    tier: string;
                  }>;
                  recent_events: Array<{
                    event_type: string;
                    metadata: Record<string, unknown>;
                    created_at: string;
                  }>;
                };
                return (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{c.email}</CardTitle>
                        <CardDescription>
                          Зарегистрирован: {formatDate(c.registered_at)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Тариф</p>
                          <p className="font-semibold">
                            {c.subscription?.tier ?? "free"} ·{" "}
                            {c.subscription?.status ?? "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Автопродление</p>
                          <p className="font-semibold">
                            {c.subscription?.auto_renew ? "Да" : "Нет"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Расшифровок (всего/мес)
                          </p>
                          <p className="font-semibold">
                            {c.usage?.total_count ?? 0} /{" "}
                            {c.usage?.monthly_count ?? 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Часов (всего/мес)
                          </p>
                          <p className="font-semibold">
                            {formatHours(c.usage?.total_seconds ?? 0)} /{" "}
                            {formatHours(c.usage?.monthly_seconds ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Окончание периода
                          </p>
                          <p className="font-semibold">
                            {formatDate(
                              c.subscription?.current_period_end ?? null,
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Последняя расшифровка
                          </p>
                          <p className="font-semibold">
                            {formatDate(c.last_transcription_at)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {c.cancellations.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">
                            Причины отмены
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {c.cancellations.map((x, i) => (
                            <div
                              key={i}
                              className="border-l-2 border-amber-500 pl-3"
                            >
                              <p className="font-medium">
                                {reasonLabel(x.reason)}{" "}
                                <span className="text-xs text-muted-foreground">
                                  · {x.tier} · {formatDate(x.created_at)}
                                </span>
                              </p>
                              {x.comment && (
                                <p className="text-muted-foreground italic">
                                  «{x.comment}»
                                </p>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Платежи ({c.payments.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        {c.payments.length === 0 ? (
                          <p className="text-muted-foreground">Нет платежей</p>
                        ) : (
                          c.payments.map((p) => (
                            <div
                              key={p.id}
                              className="flex justify-between border-b border-border py-1.5"
                            >
                              <span>
                                {formatDate(p.created_at)} · {p.tier}
                              </span>
                              <span>
                                <Badge
                                  variant={
                                    p.status === "succeeded"
                                      ? "default"
                                      : "destructive"
                                  }
                                  className="mr-2"
                                >
                                  {p.status}
                                </Badge>
                                {formatMoney(p.amount)}
                              </span>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Последние события (50)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1 max-h-96 overflow-y-auto font-mono">
                        {c.recent_events.length === 0 ? (
                          <p className="text-muted-foreground">Нет событий</p>
                        ) : (
                          c.recent_events.map((e, i) => (
                            <div
                              key={i}
                              className="flex justify-between gap-2 border-b border-border/50 py-1"
                            >
                              <span>
                                <span className="text-muted-foreground">
                                  {new Date(e.created_at).toLocaleString(
                                    "ru-RU",
                                  )}
                                </span>{" "}
                                ·{" "}
                                <span className="text-gold-dark">
                                  {e.event_type}
                                </span>
                              </span>
                              <span className="text-muted-foreground truncate max-w-[40%]">
                                {JSON.stringify(e.metadata ?? {})}
                              </span>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={!!detailMetric}
        onOpenChange={(o) => !o && setDetailMetric(null)}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailMetric
                ? (METRIC_TITLES[detailMetric] ?? detailMetric)
                : ""}
            </DialogTitle>
            <DialogDescription>
              За {days} дн. · Найдено записей: {detailItems.length}
            </DialogDescription>
          </DialogHeader>
          {loadingDetails ? (
            <p className="text-center text-muted-foreground py-8">Загрузка…</p>
          ) : detailItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет данных</p>
          ) : (
            <div className="space-y-1">
              {detailItems.map((it, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm"
                >
                  <button
                    className="text-gold-dark hover:underline font-medium"
                    onClick={() => {
                      const em = (it.email as string) ?? "";
                      setEmailQuery(em);
                      setDetailMetric(null);
                      setTimeout(() => loadCard(), 50);
                      const tab = document.querySelector<HTMLElement>(
                        '[role="tab"][value="user"]',
                      );
                      tab?.click();
                    }}
                  >
                    {(it.email as string) ?? "—"}
                  </button>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
                    {it.tier !== undefined && (
                      <Badge variant="outline">{String(it.tier)}</Badge>
                    )}
                    {it.status !== undefined && it.status !== null && (
                      <span>статус: {String(it.status)}</span>
                    )}
                    {it.amount !== undefined && (
                      <span className="font-semibold text-foreground">
                        {formatMoney(Number(it.amount))}
                      </span>
                    )}
                    {it.duration !== undefined && (
                      <span>{(Number(it.duration) / 60).toFixed(1)} мин</span>
                    )}
                    {it.file_name !== undefined && (
                      <span className="truncate max-w-[200px]">
                        {String(it.file_name)}
                      </span>
                    )}
                    {it.reason !== undefined && (
                      <span>причина: {reasonLabel(String(it.reason))}</span>
                    )}
                    {it.comment !== undefined && it.comment !== null && (
                      <span className="italic">«{String(it.comment)}»</span>
                    )}
                    {it.auto_renew !== undefined && (
                      <span>авто: {it.auto_renew ? "вкл" : "выкл"}</span>
                    )}
                    {it.period_end !== undefined && it.period_end !== null && (
                      <span>до {formatDate(String(it.period_end))}</span>
                    )}
                    {it.last_login !== undefined && (
                      <span>вход: {formatDate(String(it.last_login))}</span>
                    )}
                    {it.logins !== undefined && (
                      <span>·{String(it.logins)} входов</span>
                    )}
                    {it.registered_at !== undefined && (
                      <span>рег. {formatDate(String(it.registered_at))}</span>
                    )}
                    {it.created_at !== undefined &&
                      it.registered_at === undefined && (
                        <span>{formatDate(String(it.created_at))}</span>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAnalytics;
